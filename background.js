import { getCandidateTabs } from "./background-core.mjs";
import {
  TITLE_REWRITE_MAX_LENGTH,
  deriveBatchLabel,
  normalizeBatchSelection,
  normalizeOrganizationPlan,
  normalizeTitleRewritePlan,
  safeGetDomain,
  truncate
} from "./background-normalizers.mjs";
import { resolveBackgroundAISettings } from "./background-ai-settings.mjs";
import "./i18n.js";
import { SEARCH_PANEL_INJECTION_FILES } from "./search-panel-injection.mjs";

const SEARCH_PANEL_BLOCKED_PROTOCOLS = ["about:", "brave:", "chrome:", "edge:", "vivaldi:"];
const i18n = globalThis.AITabI18n;

let organizationState = createIdleState();

function t(locale, key, vars) {
  return i18n.t(locale || i18n.DEFAULT_UI_LANGUAGE, key, vars);
}

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    chrome.tabs.create({ url: chrome.runtime.getURL("options.html") });
  }
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command === "search-tabs") {
    try {
      await openTabSearch();
    } catch (error) {
      console.error("Search command failed:", error);
    }

    return;
  }

  if (command === "organize-tabs-ai") {
    try {
      await organizeTabsWithAI();
    } catch (error) {
      console.error("Command failed:", error);
    }
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  handleRuntimeMessage(message)
    .then((result) => sendResponse(result))
    .catch((error) => {
      console.error("Runtime message failed:", error);
      sendResponse({ ok: false, error: error instanceof Error ? error.message : "Unknown error" });
    });

  return true;
});

async function handleRuntimeMessage(message) {
  switch (message?.type) {
    case "get-organization-state":
      return { ok: true, state: organizationState };
    case "run-ai-organization":
      return await organizeTabsWithAI(message.windowId);
    case "run-tab-search":
      await openTabSearch();
      return { ok: true };
    case "open-settings-page":
      await chrome.runtime.openOptionsPage();
      return { ok: true };
    case "get-tabs":
      return { ok: true, tabs: await getSearchableTabs() };
    case "activate-tab":
      await activateTab(message.tabId);
      return { ok: true };
    case "open-url":
      await openUrl(message.url);
      return { ok: true };
    case "close-tab":
      await closeTab(message.tabId);
      return { ok: true };
    case "bookmark-and-close-tab":
      await bookmarkAndCloseTab(message.tabId);
      return { ok: true };
    case "preview-batch-tabs":
      return await previewBatchTabs(message.query, message.windowId);
    case "apply-batch-action":
      return await applyBatchAction(message);
    default: {
      const { uiLanguage } = await getAISettings();
      return { ok: false, error: t(uiLanguage, "unsupportedMessageType") };
    }
  }
}

async function openTabSearch() {
  const [[tab], tabs] = await Promise.all([
    chrome.tabs.query({ active: true, lastFocusedWindow: true }),
    getSearchableTabs()
  ]);

  if (!tab?.id) {
    await openStandaloneSearchWindow();
    return;
  }

  if (isSearchPanelBlockedTab(tab.url)) {
    await openStandaloneSearchWindow(tab.windowId);
    return;
  }

  const payload = { type: "open-tab-search", tabs };

  try {
    await chrome.tabs.sendMessage(tab.id, payload);
  } catch (_error) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: SEARCH_PANEL_INJECTION_FILES
      });

      await chrome.tabs.sendMessage(tab.id, payload);
    } catch (_innerError) {
      await openStandaloneSearchWindow(tab.windowId);
    }
  }
}

async function openStandaloneSearchWindow(sourceWindowId) {
  const url = new URL(chrome.runtime.getURL("search.html"));
  if (sourceWindowId) {
    url.searchParams.set("sourceWindowId", sourceWindowId);
  }
  await chrome.windows.create({
    url: url.toString(),
    type: "popup",
    width: 820,
    height: 720
  });
}

async function organizeTabsWithAI(windowId) {
  const settings = await getAISettings();
  const locale = settings.uiLanguage;

  if (organizationState.busy) {
    return { ok: false, error: t(locale, "backgroundAlreadyRunning") };
  }

  organizationState = createBusyState(locale);
  pushLog(t(locale, "backgroundLogStart"), locale);

  try {
    updateState({
      phase: "validating",
      title: t(locale, "backgroundCheckSettings"),
      detail: t(locale, "backgroundCheckSettingsDetail")
    });

    if (!settings.apiKey) {
      throw new Error(t(locale, "backgroundMissingApiKey"));
    }

    updateState({
      phase: "reading_tabs",
      title: t(locale, "backgroundReadTabs"),
      detail: t(locale, "backgroundReadTabsDetail")
    });

    const windowTabs = await chrome.tabs.query(windowId ? { windowId } : { currentWindow: true });
    const candidateTabs = getCandidateTabs(windowTabs);
    pushLog(t(locale, "backgroundLogReadTabs", { count: candidateTabs.length }), locale);

    if (candidateTabs.length < 2) {
      const reason = t(locale, "backgroundNeedTwoTabs");
      finishSuccess(reason, { groups: [], ungroupedTabIds: candidateTabs.map((tab) => tab.id) }, locale);
      return { ok: true, skipped: true, reason, state: organizationState };
    }

    updateState({
      phase: "requesting_ai",
      title: t(locale, "backgroundRequestAI"),
      detail: t(locale, "backgroundRequestAIDetail", { host: new URL(settings.endpoint).hostname })
    });

    const rawPlan = await requestAIOrganizationPlan(candidateTabs, settings);
    pushLog(t(locale, "backgroundLogAIPlanReady"), locale);

    updateState({
      phase: "validating_plan",
      title: t(locale, "backgroundValidatePlan"),
      detail: t(locale, "backgroundValidatePlanDetail")
    });

    const plan = normalizeOrganizationPlan(rawPlan, candidateTabs);
    pushLog(t(locale, "backgroundLogValidated", { count: plan.groups.length }), locale);

    updateState({
      phase: "applying",
      title: t(locale, "backgroundApplyPlan"),
      detail: t(locale, "backgroundApplyPlanDetail")
    });

    await applyOrganizationPlan(plan, candidateTabs, windowTabs);

    let renamedCount = 0;

    if (settings.experimentalTitleRewriteEnabled) {
      updateState({
        phase: "rewriting_titles",
        title: t(locale, "backgroundRewriteTitles"),
        detail: t(locale, "backgroundRewriteTitlesDetail")
      });

      try {
        renamedCount = await rewriteTabTitlesWithAI(candidateTabs, settings);

        if (renamedCount > 0) {
          pushLog(t(locale, "backgroundLogRewritten", { count: renamedCount }), locale);
        } else {
          pushLog(t(locale, "backgroundLogRewriteSkippedNone"), locale);
        }
      } catch (error) {
        pushLog(
          t(locale, "backgroundLogRewriteSkipped", {
            message: error instanceof Error ? error.message : "Unknown error"
          }),
          locale
        );
      }
    }

    const summary = buildPlanSummary(plan, renamedCount, locale);
    finishSuccess(summary, plan, locale);
    return { ok: true, summary, plan, renamedCount, state: organizationState };
  } catch (error) {
    finishError(error instanceof Error ? error.message : t(locale, "organizeFailed"), locale);
    throw error;
  }
}

async function previewBatchTabs(query, windowId) {
  const trimmedQuery = String(query || "").trim();
  const settings = await getAISettings();
  const locale = settings.uiLanguage;

  if (!trimmedQuery) {
    return { ok: false, error: t(locale, "backgroundPromptNatural") };
  }

  if (!settings.apiKey) {
    return { ok: false, error: t(locale, "backgroundMissingApiKey") };
  }

  const currentTabs = getCandidateTabs(await chrome.tabs.query(windowId ? { windowId } : { currentWindow: true }));

  if (currentTabs.length === 0) {
    return { ok: false, error: t(locale, "backgroundNoActionableTabs") };
  }

  const rawSelection = await requestBatchSelection(trimmedQuery, currentTabs, settings);
  const selection = normalizeBatchSelection(rawSelection, currentTabs);

  return {
    ok: true,
    preview: {
      query: trimmedQuery,
      rationale: selection.rationale,
      suggestedLabel: selection.suggestedLabel,
      tabs: selection.tabs
    }
  };
}

async function applyBatchAction(message) {
  const tabIds = Array.isArray(message?.tabIds) ? message.tabIds.map((value) => Number(value)).filter(Boolean) : [];
  const action = String(message?.action || "");
  const query = String(message?.query || "").trim();
  const customLabel = String(message?.label || "").trim();
  const { uiLanguage } = await getAISettings();

  if (tabIds.length === 0) {
    return { ok: false, error: t(uiLanguage, "backgroundNoSelectedTabs") };
  }

  const results = await Promise.allSettled(tabIds.map((tabId) => chrome.tabs.get(tabId)));
  const validTabs = results.filter((r) => r.status === "fulfilled").map((r) => r.value).filter((tab) => tab.id);
  const validTabIds = validTabs.map((tab) => tab.id);

  if (validTabs.length === 0) {
    return { ok: false, error: t(uiLanguage, "backgroundSelectedTabsMissing") };
  }

  if (action === "group") {
    const label = customLabel || deriveBatchLabel(query, validTabs);
    const groupId = await chrome.tabs.group({ tabIds: validTabIds });
    await chrome.tabGroups.update(groupId, {
      title: label,
      color: "grey",
      collapsed: false
    });

    return { ok: true, summary: t(uiLanguage, "backgroundGroupedSummary", { count: validTabs.length, label }) };
  }

  if (action === "delete") {
    await chrome.tabs.remove(validTabIds);
    return { ok: true, summary: t(uiLanguage, "backgroundClosedSummary", { count: validTabs.length }) };
  }

  if (action === "bookmark") {
    const folderId = await ensureBookmarkFolder(customLabel || deriveBatchLabel(query, validTabs));

    for (const tab of validTabs) {
      await chrome.bookmarks.create({
        parentId: folderId,
        title: tab.title || tab.url || t(uiLanguage, "backgroundUntitled"),
        url: tab.url
      });
    }

    return { ok: true, summary: t(uiLanguage, "backgroundBookmarkedSummary", { count: validTabs.length }) };
  }

  if (action === "bookmark_close") {
    const folderId = await ensureBookmarkFolder(customLabel || deriveBatchLabel(query, validTabs));

    for (const tab of validTabs) {
      if (!tab.url) {
        continue;
      }

      await chrome.bookmarks.create({
        parentId: folderId,
        title: tab.title || tab.url || t(uiLanguage, "backgroundUntitled"),
        url: tab.url
      });
    }

    await chrome.tabs.remove(validTabs.map((tab) => tab.id));
    return { ok: true, summary: t(uiLanguage, "backgroundBookmarkedClosedSummary", { count: validTabs.length }) };
  }

  return { ok: false, error: t(uiLanguage, "backgroundUnsupportedAction") };
}

async function requestAIOrganizationPlan(tabs, settings) {
  const payload = await requestJSONFromAI(
    settings,
    "You organize browser tabs. Return strict JSON only. Every tab id must appear exactly once, either in groups[].tabIds or ungroupedTabIds. Prefer 2-6 groups. Use concise group names. Valid colors: grey, blue, red, yellow, green, pink, purple, cyan, orange.",
    buildOrganizationPrompt(tabs, settings.preference)
  );

  return payload;
}

async function requestBatchSelection(query, tabs, settings) {
  const now = Date.now();

  return await requestJSONFromAI(
    settings,
    "You select browser tabs from a list based on a natural-language request. Return strict JSON only. Pick all relevant tabs — match against title, url, AND domain (e.g. a query for 'Pinterest' should match tabs whose domain contains 'pinterest' even if the title does not mention it). Output selectedTabIds as an array of numbers, a short rationale string, and a suggestedLabel string. Each tab may include idleMin (integer: minutes since last accessed) — use it for time-based queries like 'not opened in 30 minutes' or 'inactive for an hour'. Tabs without idleMin have unknown access time.",
    JSON.stringify(
      {
        task: "Select tabs that match the user's natural-language request.",
        query,
        outputSchema: {
          selectedTabIds: ["number"],
          rationale: "string",
          suggestedLabel: "string"
        },
        tabs: tabs.map((tab) => {
          const idleMin =
            tab.lastAccessed && tab.lastAccessed > 0
              ? Math.floor((now - tab.lastAccessed) / 60000)
              : null;
          const entry = {
            id: tab.id,
            title: tab.title || "Untitled",
            url: tab.url || "",
            domain: safeGetDomain(tab.url)
          };
          if (idleMin !== null) entry.idleMin = idleMin;
          return entry;
        })
      },
      null,
      2
    )
  );
}

async function requestAITitleRewritePlan(tabs, settings) {
  return await requestJSONFromAI(
    settings,
    "You rewrite browser tab titles into shorter, clearer labels. Return strict JSON only. Only include tabs that genuinely benefit from a shorter or clearer title. Keep each rewrittenTitle concise, specific, and easy to scan. Remove low-value noise such as repeated brand names, boilerplate suffixes, separators, generic navigation words, and marketing fluff unless they are essential for understanding. Avoid brand repetition unless needed. Each rewrittenTitle must be at most 24 characters.",
    JSON.stringify(
      {
        task: "Shorten unclear or overly long tab titles from the current browser window.",
        outputSchema: {
          titles: [
            {
              tabId: "number",
              rewrittenTitle: "string"
            }
          ]
        },
        constraints: [
          "Only include tabs that need rewriting.",
          "Use the page language when obvious.",
          "Keep the new title <= 24 characters.",
          "Do not make up details not present in the title or URL.",
          "Prefer compact, scannable labels.",
          "Delete noisy suffixes like site names, taglines, separators, or template words when they do not add meaning.",
          "Prefer the core object or task, for example 'Pull Request' over 'Pull Request · GitHub', '收件箱' over 'Inbox - Gmail', '账单设置' over 'Billing settings | Example'."
        ],
        tabs: tabs.map((tab) => ({
          id: tab.id,
          title: tab.title || "Untitled",
          url: tab.url || "",
          domain: safeGetDomain(tab.url)
        }))
      },
      null,
      2
    )
  );
}

async function requestJSONFromAI(settings, systemPrompt, userPrompt) {
  const locale = settings.uiLanguage;
  const response = await fetch(settings.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.apiKey}`
    },
    body: JSON.stringify({
      model: settings.model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ]
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(t(locale, "aiRequestFailed", { status: response.status, message: truncate(errorText, 140) }));
  }

  const payload = await response.json();
  const content = extractAssistantContent(payload);

  if (!content) {
    throw new Error(t(locale, "aiNoContent"));
  }

  return parseJsonFromText(content, locale);
}

function buildOrganizationPrompt(tabs, preference) {
  return JSON.stringify(
    {
      task: "Sort and group tabs from the current browser window.",
      preference:
        preference ||
        "Keep related work together, cluster by topic or intent, avoid too many tiny groups, leave obviously unrelated tabs ungrouped if needed.",
      outputSchema: {
        groups: [
          {
            name: "string",
            color: "grey|blue|red|yellow|green|pink|purple|cyan|orange",
            collapsed: "boolean",
            tabIds: ["number"]
          }
        ],
        ungroupedTabIds: ["number"]
      },
      tabs: tabs.map((tab) => ({
        id: tab.id,
        title: tab.title || "Untitled",
        url: tab.url || "",
        domain: safeGetDomain(tab.url),
        index: tab.index,
        active: Boolean(tab.active),
        audible: Boolean(tab.audible)
      }))
    },
    null,
    2
  );
}


async function applyOrganizationPlan(plan, candidateTabs, allWindowTabs) {
  const { uiLanguage } = await getAISettings();
  const pinnedCount = allWindowTabs.filter((tab) => tab.pinned).length;
  const desiredOrder = [...plan.groups.flatMap((group) => group.tabIds), ...plan.ungroupedTabIds];
  const groupedTabs = candidateTabs.filter((tab) => tab.groupId !== -1).map((tab) => tab.id);

  if (groupedTabs.length > 0) {
    pushLog(t(uiLanguage, "backgroundLogUngroup", { count: groupedTabs.length }), uiLanguage);
    await chrome.tabs.ungroup(groupedTabs);
  }

  for (let index = 0; index < desiredOrder.length; index += 1) {
    await chrome.tabs.move(desiredOrder[index], { index: pinnedCount + index });
  }

  for (const group of plan.groups) {
    const groupId = await chrome.tabs.group({ tabIds: group.tabIds });
    await chrome.tabGroups.update(groupId, {
      title: group.name,
      color: group.color,
      collapsed: group.collapsed
    });
  }
}

function buildPlanSummary(plan, renamedCount = 0, locale = "cn") {
  const renameSuffix = renamedCount > 0 ? t(locale, "backgroundRenameSuffix", { count: renamedCount }) : "";

  if (plan.groups.length === 0) {
    return t(locale, "backgroundSummaryUngrouped", { count: plan.ungroupedTabIds.length, suffix: renameSuffix });
  }

  return t(locale, "backgroundSummaryGrouped", {
    groups: plan.groups.length,
    count: plan.groups.flatMap((group) => group.tabIds).length,
    suffix: renameSuffix
  });
}

async function getAISettings() {
  const stored = await chrome.storage.local.get([
    "aiEndpoint",
    "aiApiKey",
    "aiModel",
    "aiPreference",
    "experimentalTitleRewriteEnabled",
    i18n.UI_LANGUAGE_STORAGE_KEY
  ]);

  return resolveBackgroundAISettings(stored);
}

async function getSearchableTabs() {
  const tabs = await chrome.tabs.query({});

  return tabs
    .filter((tab) => tab.id && tab.windowId)
    .map((tab) => ({
      id: tab.id,
      windowId: tab.windowId,
      title: tab.title || "Untitled",
      url: tab.url || "",
      favIconUrl: tab.favIconUrl || "",
      lastAccessed: tab.lastAccessed || null
    }));
}

async function activateTab(tabId) {
  const tab = await chrome.tabs.get(tabId);
  await chrome.tabs.update(tabId, { active: true });
  await chrome.windows.update(tab.windowId, { focused: true });
}

async function openUrl(url) {
  const target = String(url || "").trim();

  if (!target) {
    return;
  }

  if (isLikelyUrl(target)) {
    const normalized = normalizeUrl(target);

    if (normalized) {
      await chrome.tabs.create({ url: normalized });
      return;
    }
  }

  await chrome.search.query({
    text: target,
    disposition: "NEW_TAB"
  });
}

function normalizeUrl(value) {
  if (!value || /\s/.test(value)) {
    return null;
  }

  try {
    const url = value.includes("://") ? new URL(value) : new URL(`https://${value}`);
    return /^https?:$/.test(url.protocol) ? url.toString() : null;
  } catch (_error) {
    return null;
  }
}

async function closeTab(tabId) {
  await chrome.tabs.remove(tabId);
}

async function bookmarkAndCloseTab(tabId) {
  const tab = await chrome.tabs.get(tabId);
  const { uiLanguage } = await getAISettings();
  const folderId = await ensureBookmarkFolder(t(uiLanguage, "backgroundSearchSaves"));

  if (tab.url) {
    await chrome.bookmarks.create({
      parentId: folderId,
      title: tab.title || tab.url || t(uiLanguage, "backgroundUntitled"),
      url: tab.url
    });
  }

  await chrome.tabs.remove(tabId);
}

async function rewriteTabTitlesWithAI(tabs, settings) {
  const candidates = tabs.filter(shouldConsiderTitleRewrite);

  if (candidates.length === 0) {
    return 0;
  }

  pushLog(t(settings.uiLanguage, "backgroundLogRewriting", { count: candidates.length }), settings.uiLanguage);

  const rawPlan = await requestAITitleRewritePlan(candidates, settings);
  const rewrites = normalizeTitleRewritePlan(rawPlan, candidates);
  const results = await Promise.all(rewrites.map((rewrite) => applyTemporaryTitleRewrite(rewrite.tabId, rewrite.title)));
  return results.filter(Boolean).length;
}


function shouldConsiderTitleRewrite(tab) {
  const title = String(tab?.title || "").trim();
  const url = String(tab?.url || "");

  if (!tab?.id || !/^https?:/i.test(url)) {
    return false;
  }

  if (!title) {
    return false;
  }

  return (
    title.length > TITLE_REWRITE_MAX_LENGTH ||
    /\s[|·•\-—]\s/.test(title) ||
    /^https?:/i.test(title) ||
    /\b(sign in|login|dashboard|home|overview|official site)\b/i.test(title)
  );
}

async function applyTemporaryTitleRewrite(tabId, title) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (nextTitle) => {
        const normalized = String(nextTitle || "").trim();

        if (!normalized) {
          return false;
        }

        const key = "__aiTabOrganizerTitleTypingTimer__";
        const owner = window;

        if (owner[key]) {
          window.clearTimeout(owner[key]);
          owner[key] = null;
        }

        document.title = normalized;
        return document.title === normalized;
      },
      args: [title]
    });

    return true;
  } catch (_error) {
    return false;
  }
}


async function ensureBookmarkFolder(name) {
  const rootId = await ensureRootBookmarkFolder();
  const children = await chrome.bookmarks.getChildren(rootId);
  const existing = children.find((node) => !node.url && node.title === name);

  if (existing?.id) {
    return existing.id;
  }

  const folder = await chrome.bookmarks.create({
    parentId: rootId,
    title: name || "Arc Tabs"
  });

  return folder.id;
}

async function ensureRootBookmarkFolder() {
  const [tree] = await chrome.bookmarks.getTree();
  const barNode = tree.children?.find((node) => node.title === "Bookmarks bar") || tree.children?.[0];

  if (!barNode?.id) {
    const { uiLanguage } = await getAISettings();
    throw new Error(t(uiLanguage, "backgroundNoBookmarkRoot"));
  }

  const existing = (await chrome.bookmarks.getChildren(barNode.id)).find(
    (node) => !node.url && node.title === "Arc Tabs"
  );

  if (existing?.id) {
    return existing.id;
  }

  const folder = await chrome.bookmarks.create({
    parentId: barNode.id,
    title: "Arc Tabs"
  });

  return folder.id;
}

function createIdleState(locale = "cn") {
  return {
    busy: false,
    phase: "idle",
    title: t(locale, "backgroundWaiting"),
    detail: t(locale, "backgroundWaitingDetail"),
    logs: [],
    summary: "",
    error: "",
    updatedAt: Date.now(),
    lastPlan: null
  };
}

function createBusyState(locale = "cn") {
  return {
    busy: true,
    phase: "starting",
    title: t(locale, "backgroundPreparing"),
    detail: t(locale, "backgroundPreparingDetail"),
    logs: [],
    summary: "",
    error: "",
    updatedAt: Date.now(),
    lastPlan: null
  };
}

function updateState(patch) {
  organizationState = {
    ...organizationState,
    ...patch,
    updatedAt: Date.now()
  };
}

function pushLog(message, locale = "cn") {
  const logs = [...organizationState.logs, { message, at: new Date().toLocaleTimeString(i18n.getLocaleTag(locale), { hour12: false }) }];
  updateState({ logs: logs.slice(-12) });
}

function finishSuccess(summary, plan, locale = "cn") {
  pushLog(summary, locale);
  updateState({
    busy: false,
    phase: "done",
    title: t(locale, "backgroundDone"),
    detail: summary,
    summary,
    error: "",
    lastPlan: plan
  });
}

function finishError(message, locale = "cn") {
  pushLog(t(locale, "backgroundLogFailed", { message }), locale);
  updateState({
    busy: false,
    phase: "error",
    title: t(locale, "backgroundError"),
    detail: message,
    error: message
  });
}

function extractAssistantContent(payload) {
  const content = payload?.choices?.[0]?.message?.content;

  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content.map((item) => item?.text || item?.content || "").join("");
  }

  return "";
}

function parseJsonFromText(text, locale = i18n?.DEFAULT_UI_LANGUAGE || "cn") {
  try {
    return JSON.parse(text);
  } catch (_error) {
    const fencedMatch = text.match(/```json\s*([\s\S]*?)```/i) || text.match(/```\s*([\s\S]*?)```/i);

    if (fencedMatch) {
      return JSON.parse(fencedMatch[1]);
    }

    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");

    if (start !== -1 && end !== -1 && end > start) {
      return JSON.parse(text.slice(start, end + 1));
    }

    throw new Error(t(locale, "aiInvalidJson"));
  }
}


function isSearchPanelBlockedTab(url) {
  return !url || SEARCH_PANEL_BLOCKED_PROTOCOLS.some((protocol) => url.startsWith(protocol));
}

function isLikelyUrl(value) {
  const input = String(value || "").trim();

  if (!input || /\s/.test(input)) {
    return false;
  }

  if (/^https?:\/\//i.test(input)) {
    return true;
  }

  return /^(localhost(?::\d+)?|(\d{1,3}\.){3}\d{1,3}(?::\d+)?|[a-z0-9-]+(\.[a-z0-9-]+)+)(\/.*)?$/i.test(input);
}
