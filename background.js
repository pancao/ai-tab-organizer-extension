import "./tab-search-debug.js";
import "./tab-search-routing.js";

const DEFAULT_AI_ENDPOINT = "https://api.openai.com/v1/chat/completions";
const DEFAULT_AI_MODEL = "gpt-4.1-mini";
const TAB_GROUP_COLORS = ["grey", "blue", "red", "yellow", "green", "pink", "purple", "cyan", "orange"];
const SEARCH_PANEL_BLOCKED_PROTOCOLS = ["about:", "brave:", "chrome:", "edge:", "vivaldi:"];
const TITLE_REWRITE_MAX_LENGTH = 24;
const {
  EXTENSION_PAGE_SEARCH_CHANNEL_NAME,
  EXTENSION_PAGE_SEARCH_REQUEST_STORAGE_KEY,
  EXTENSION_PAGE_SEARCH_RESPONSE_STORAGE_KEY,
  OPTIONS_PAGE_SEARCH_HASH_PREFIX,
  OPTIONS_PAGE_SEARCH_HASH_RESPONSE_STORAGE_KEY,
  EXTENSION_PAGE_PORT_NAME,
  TAB_SEARCH_DELIVERY,
  buildStandaloneSearchUrl,
  isExtensionPageSearchResponseMatch,
  isOptionsPagePortName,
  resolveOptionsPageConnectionTabId,
  resolveTabSearchDelivery,
  shouldBackgroundHandleRuntimeMessage
} = globalThis.TabSearchRouting;
const { recordTabSearchDebug } = globalThis.TabSearchDebug;

let organizationState = createIdleState();
let standaloneSearchWindowId = null;
let extensionPageRequestId = 0;

const extensionPagePorts = new Map();
const extensionPageUnboundPorts = new Set();
const extensionPageChannel = typeof BroadcastChannel === "function"
  ? new BroadcastChannel(EXTENSION_PAGE_SEARCH_CHANNEL_NAME)
  : null;
const pendingExtensionPageChannelRequests = new Map();
const pendingExtensionPageRequests = new Map();
const pendingExtensionPageHashRequests = new Map();
const pendingExtensionPageStorageRequests = new Map();

if (extensionPageChannel) {
  extensionPageChannel.addEventListener("message", (event) => {
    const message = event?.data;

    if (message?.type !== "open-extension-tab-search-result") {
      return;
    }

    const pending = pendingExtensionPageChannelRequests.get(message.requestId);

    if (!pending) {
      return;
    }

    pendingExtensionPageChannelRequests.delete(message.requestId);
    clearTimeout(pending.timerId);
    pending.resolve({
      ok: Boolean(message.ok),
      error: message.error || (message.ok ? "" : "options-channel-rejected")
    });
    void recordTabSearchDebug("background", "search.extension-overlay.channel.result", {
      requestId: message.requestId,
      ok: Boolean(message.ok),
      error: message.error || ""
    });
  });
}

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    chrome.tabs.create({ url: chrome.runtime.getURL("options.html") });
  }
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command === "search-tabs") {
    await recordTabSearchDebug("background", "command.search-tabs", { command });

    try {
      await openTabSearch();
    } catch (error) {
      await recordTabSearchDebug("background", "command.search-tabs.error", error);
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
  if (!shouldBackgroundHandleRuntimeMessage(message)) {
    return undefined;
  }

  handleRuntimeMessage(message)
    .then((result) => sendResponse(result))
    .catch((error) => {
      console.error("Runtime message failed:", error);
      sendResponse({ ok: false, error: error instanceof Error ? error.message : "Unknown error" });
    });

  return true;
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local") {
    return;
  }

  const response = changes[EXTENSION_PAGE_SEARCH_RESPONSE_STORAGE_KEY]?.newValue;
  const hashResponse = changes[OPTIONS_PAGE_SEARCH_HASH_RESPONSE_STORAGE_KEY]?.newValue;

  if (hashResponse?.requestId) {
    const pendingHash = pendingExtensionPageHashRequests.get(hashResponse.requestId);

    if (pendingHash) {
      pendingExtensionPageHashRequests.delete(hashResponse.requestId);
      clearTimeout(pendingHash.timerId);
      pendingHash.resolve({
        ok: Boolean(hashResponse.ok),
        error: hashResponse.error || (hashResponse.ok ? "" : "options-hash-rejected")
      });
    }
  }

  if (!response?.requestId) {
    return;
  }

  const pending = pendingExtensionPageStorageRequests.get(response.requestId);

  if (!pending || !isExtensionPageSearchResponseMatch(response, response.requestId)) {
    return;
  }

  pendingExtensionPageStorageRequests.delete(response.requestId);
  clearTimeout(pending.timerId);
  pending.resolve({
    ok: Boolean(response.ok),
    error: response.error || (response.ok ? "" : "options-storage-rejected")
  });
});

chrome.runtime.onConnect.addListener((port) => {
  if (!isOptionsPagePortName(port.name)) {
    return;
  }

  let connectedTabId = resolveOptionsPageConnectionTabId({
    senderTabId: port.sender?.tab?.id,
    registeredTabId: null
  });

  if (connectedTabId) {
    extensionPagePorts.set(connectedTabId, port);
    void recordTabSearchDebug("background", "options-port.connected", {
      tabId: connectedTabId,
      source: "sender"
    });
  } else {
    extensionPageUnboundPorts.add(port);
    void recordTabSearchDebug("background", "options-port.connected", {
      tabId: null,
      source: "unbound"
    });
  }

  port.onMessage.addListener((message) => {
    if (message?.type === "register-options-page") {
      const nextTabId = resolveOptionsPageConnectionTabId({
        senderTabId: port.sender?.tab?.id,
        registeredTabId: message.tabId
      });

      if (!nextTabId) {
        extensionPageUnboundPorts.add(port);
        void recordTabSearchDebug("background", "options-port.registered", {
          tabId: null,
          source: "unbound"
        });
        return;
      }

      if (connectedTabId && connectedTabId !== nextTabId && extensionPagePorts.get(connectedTabId) === port) {
        extensionPagePorts.delete(connectedTabId);
      }

      extensionPageUnboundPorts.delete(port);
      connectedTabId = nextTabId;
      extensionPagePorts.set(connectedTabId, port);
      void recordTabSearchDebug("background", "options-port.registered", {
        tabId: connectedTabId,
        source: port.sender?.tab?.id ? "sender" : "message"
      });
      return;
    }

    if (message?.type === "open-extension-tab-search-result") {
      const pending = pendingExtensionPageRequests.get(message.requestId);

      if (!pending) {
        return;
      }

      pendingExtensionPageRequests.delete(message.requestId);
      clearTimeout(pending.timerId);
      pending.resolve({
        ok: Boolean(message.ok),
        error: message.error || (message.ok ? "" : "options-page-rejected")
      });
      void recordTabSearchDebug("background", "options-port.response", {
        requestId: message.requestId,
        ok: Boolean(message.ok),
        error: message.error || ""
      });
    }
  });

  port.onDisconnect.addListener(() => {
    if (connectedTabId && extensionPagePorts.get(connectedTabId) === port) {
      extensionPagePorts.delete(connectedTabId);
      void recordTabSearchDebug("background", "options-port.disconnected", { tabId: connectedTabId });
    }

    extensionPageUnboundPorts.delete(port);

    for (const [requestId, pending] of pendingExtensionPageRequests.entries()) {
      if (pending.port !== port) {
        continue;
      }

      pendingExtensionPageRequests.delete(requestId);
      clearTimeout(pending.timerId);
      pending.resolve({ ok: false, error: "options-port-disconnected" });
    }
  });
});

async function handleRuntimeMessage(message) {
  switch (message?.type) {
    case "get-organization-state":
      return { ok: true, state: organizationState };
    case "run-ai-organization":
      return await organizeTabsWithAI();
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
      return await previewBatchTabs(message.query);
    case "apply-batch-action":
      return await applyBatchAction(message);
    default:
      return { ok: false, error: "Unsupported message type." };
  }
}

async function openTabSearch() {
  const [[tab], tabs] = await Promise.all([
    chrome.tabs.query({ active: true, lastFocusedWindow: true }),
    getSearchableTabs()
  ]);

  const delivery = resolveTabSearchDelivery({
    url: tab?.url,
    blockedProtocols: SEARCH_PANEL_BLOCKED_PROTOCOLS,
    optionsPageUrl: chrome.runtime.getURL("options.html")
  });

  await recordTabSearchDebug("background", "search.delivery", {
    tabId: tab?.id || null,
    url: tab?.url || "",
    delivery
  });

  if (!tab?.id || delivery === TAB_SEARCH_DELIVERY.STANDALONE_WINDOW) {
    await openStandaloneSearchWindow(
      !tab?.id ? "no-active-tab" : "blocked-delivery",
      {
        delivery,
        tabId: tab?.id || null,
        sourceUrl: tab?.url || ""
      }
    );
    return;
  }

  const payload = { type: "open-tab-search", tabs };

  if (delivery === TAB_SEARCH_DELIVERY.EXTENSION_PAGE_OVERLAY) {
    const hashResult = await requestExtensionPageSearchOverlayViaHash(tab.id);
    await recordTabSearchDebug("background", "search.extension-overlay.hash", {
      tabId: tab.id,
      ok: hashResult.ok,
      error: hashResult.error || ""
    });

    if (hashResult.ok) {
      return;
    }

    const overlayResult = await requestExtensionPageSearchOverlay(tab.id, tabs);
    await recordTabSearchDebug("background", "search.extension-overlay.result", {
      tabId: tab.id,
      ok: overlayResult.ok,
      error: overlayResult.error || ""
    });

    if (!overlayResult.ok) {
      const extensionOverlayTrace = formatExtensionOverlayDebugTrace({
        hashResult,
        overlayResult
      });

      await openStandaloneSearchWindow("extension-overlay-failed", {
        delivery,
        error: overlayResult.error || "",
        trace: extensionOverlayTrace,
        tabId: tab.id,
        sourceUrl: tab?.url || ""
      });
    }

    return;
  }

  try {
    await chrome.tabs.sendMessage(tab.id, payload);
    await recordTabSearchDebug("background", "search.page-overlay.sent", { tabId: tab.id });
  } catch (_error) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["tab-search-debug.js", "ai-provider-config.js", "content.js"]
      });

      await chrome.tabs.sendMessage(tab.id, payload);
      await recordTabSearchDebug("background", "search.page-overlay.injected", { tabId: tab.id });
    } catch (_innerError) {
      await recordTabSearchDebug("background", "search.page-overlay.fallback-window", { tabId: tab.id });
      await openStandaloneSearchWindow("page-overlay-failed", {
        delivery,
        tabId: tab.id,
        sourceUrl: tab?.url || ""
      });
    }
  }
}

function formatExtensionOverlayDebugTrace({ hashResult, overlayResult }) {
  const overlayAttempts = overlayResult?.attempts || {};

  return [
    `hash=${hashResult?.ok ? "ok" : (hashResult?.error || "skipped")}`,
    `channel=${overlayAttempts.channel || "skipped"}`,
    `storage=${overlayAttempts.storage || "skipped"}`,
    `port=${overlayAttempts.port || "skipped"}`
  ].join(" | ");
}

function requestExtensionPageSearchOverlayViaHash(tabId) {
  const requestId = `options-hash-search-${Date.now()}-${extensionPageRequestId += 1}`;
  const nextUrl = `${chrome.runtime.getURL("options.html")}${OPTIONS_PAGE_SEARCH_HASH_PREFIX}${requestId}`;

  return new Promise((resolve) => {
    const timerId = setTimeout(() => {
      pendingExtensionPageHashRequests.delete(requestId);
      void recordTabSearchDebug("background", "search.extension-overlay.hash.timeout", {
        tabId,
        requestId
      });
      resolve({ ok: false, error: "options-hash-timeout" });
    }, 1200);

    pendingExtensionPageHashRequests.set(requestId, {
      resolve,
      timerId
    });

    chrome.tabs.update(tabId, { url: nextUrl }).then(() => {
      void recordTabSearchDebug("background", "search.extension-overlay.hash.requested", {
        tabId,
        requestId
      });
    }).catch((error) => {
      pendingExtensionPageHashRequests.delete(requestId);
      clearTimeout(timerId);
      const message = error instanceof Error ? error.message : "options-hash-update-failed";
      void recordTabSearchDebug("background", "search.extension-overlay.hash.error", {
        tabId,
        requestId,
        error: message
      });
      resolve({ ok: false, error: message });
    });
  });
}

async function openStandaloneSearchWindow(reason, context) {
  const targetUrl = buildStandaloneSearchUrl(
    chrome.runtime.getURL("search.html"),
    reason,
    context
  );

  if (standaloneSearchWindowId) {
    try {
      const tabs = await chrome.tabs.query({ windowId: standaloneSearchWindowId });

      if (tabs[0]?.id) {
        await chrome.tabs.update(tabs[0].id, { url: targetUrl });
      }

      await chrome.windows.update(standaloneSearchWindowId, {
        focused: true,
        drawAttention: true
      });
      await recordTabSearchDebug("background", "search.standalone.reused", { windowId: standaloneSearchWindowId });
      return;
    } catch (_error) {
      standaloneSearchWindowId = null;
    }
  }

  const createdWindow = await chrome.windows.create({
    url: targetUrl,
    type: "popup",
    width: 820,
    height: 720
  });

  standaloneSearchWindowId = createdWindow?.id || null;
  await recordTabSearchDebug("background", "search.standalone.created", { windowId: standaloneSearchWindowId });
}

function requestExtensionPageSearchOverlay(tabId, tabs) {
  return requestExtensionPageSearchOverlayViaChannel(tabId, tabs).then(async (channelResult) => {
    if (channelResult.ok) {
      return channelResult;
    }

    const storageResult = await requestExtensionPageSearchOverlayViaStorage(tabId, tabs);

    if (storageResult.ok) {
      return storageResult;
    }

    const portResult = await requestExtensionPageSearchOverlayViaPort(tabId, tabs);

    if (portResult.ok) {
      return portResult;
    }

    return {
      ok: false,
      attempts: {
        channel: channelResult.ok ? "ok" : (channelResult.error || "failed"),
        storage: storageResult.ok ? "ok" : (storageResult.error || "failed"),
        port: portResult.ok ? "ok" : (portResult.error || "failed")
      },
      error: [channelResult.error, storageResult.error, portResult.error]
        .filter(Boolean)
        .join(" / ") || "options-overlay-unavailable"
    };
  });
}

function requestExtensionPageSearchOverlayViaChannel(tabId, tabs) {
  if (!extensionPageChannel) {
    void recordTabSearchDebug("background", "search.extension-overlay.channel.unavailable", { tabId });
    return Promise.resolve({ ok: false, error: "options-channel-unavailable" });
  }

  const requestId = `extension-channel-search-${Date.now()}-${extensionPageRequestId += 1}`;

  return new Promise((resolve) => {
    const timerId = setTimeout(() => {
      pendingExtensionPageChannelRequests.delete(requestId);
      void recordTabSearchDebug("background", "search.extension-overlay.channel.timeout", {
        tabId,
        requestId
      });
      resolve({ ok: false, error: "options-channel-timeout" });
    }, 1200);

    pendingExtensionPageChannelRequests.set(requestId, {
      resolve,
      timerId
    });

    try {
      void recordTabSearchDebug("background", "search.extension-overlay.channel.requested", {
        tabId,
        requestId,
        tabCount: Array.isArray(tabs) ? tabs.length : 0
      });
      extensionPageChannel.postMessage({
        type: "open-extension-tab-search",
        requestId,
        targetTabId: tabId,
        tabs
      });
    } catch (error) {
      pendingExtensionPageChannelRequests.delete(requestId);
      clearTimeout(timerId);
      const message = error instanceof Error ? error.message : "options-channel-post-failed";
      void recordTabSearchDebug("background", "search.extension-overlay.channel.error", {
        tabId,
        requestId,
        error: message
      });
      resolve({ ok: false, error: message });
    }
  });
}

function requestExtensionPageSearchOverlayViaStorage(tabId, tabs) {
  const requestId = `extension-storage-search-${Date.now()}-${extensionPageRequestId += 1}`;

  return new Promise((resolve) => {
    const timerId = setTimeout(() => {
      pendingExtensionPageStorageRequests.delete(requestId);
      void recordTabSearchDebug("background", "search.extension-overlay.storage.timeout", {
        tabId,
        requestId
      });
      resolve({ ok: false, error: "options-storage-timeout" });
    }, 1500);

    pendingExtensionPageStorageRequests.set(requestId, {
      resolve,
      timerId
    });

    void recordTabSearchDebug("background", "search.extension-overlay.storage.requested", {
      tabId,
      requestId,
      tabCount: Array.isArray(tabs) ? tabs.length : 0
    });

    chrome.storage.local.set({
      [EXTENSION_PAGE_SEARCH_REQUEST_STORAGE_KEY]: {
        requestId,
        targetTabId: tabId,
        tabs,
        at: Date.now()
      }
    }).catch((error) => {
      pendingExtensionPageStorageRequests.delete(requestId);
      clearTimeout(timerId);
      const message = error instanceof Error ? error.message : "options-storage-set-failed";
      void recordTabSearchDebug("background", "search.extension-overlay.storage.error", {
        tabId,
        requestId,
        error: message
      });
      resolve({ ok: false, error: message });
    });
  });
}

function requestExtensionPageSearchOverlayViaPort(tabId, tabs) {
  const candidatePorts = [];
  const mappedPort = extensionPagePorts.get(tabId);

  if (mappedPort) {
    candidatePorts.push({ port: mappedPort, source: "mapped" });
  }

  if (candidatePorts.length === 0) {
    for (const port of extensionPageUnboundPorts) {
      candidatePorts.push({ port, source: "unbound" });
    }
  }

  if (candidatePorts.length === 0) {
    void recordTabSearchDebug("background", "search.extension-overlay.no-port", { tabId });
    return Promise.resolve({ ok: false, error: "options-port-missing" });
  }

  return tryExtensionPageOverlayPorts(candidatePorts, tabId, tabs);
}

function tryExtensionPageOverlayPorts(candidatePorts, tabId, tabs) {
  const attempts = Array.isArray(candidatePorts) ? candidatePorts : [];
  const errors = [];

  return attempts.reduce((chain, candidate) => {
    return chain.then(async (result) => {
      if (result?.ok) {
        return result;
      }

      const attemptResult = await requestExtensionPageOverlayThroughPort(candidate, tabId, tabs);

      if (!attemptResult.ok && attemptResult.error) {
        errors.push(attemptResult.error);
      }

      return attemptResult;
    });
  }, Promise.resolve({ ok: false, error: "" })).then((result) => {
    if (result?.ok) {
      return result;
    }

    return {
      ok: false,
      error: errors.filter(Boolean).join(" / ") || "options-port-failed"
    };
  });
}

function requestExtensionPageOverlayThroughPort(candidate, tabId, tabs) {
  const port = candidate?.port;

  if (!port) {
    return Promise.resolve({ ok: false, error: "options-port-missing" });
  }

  const requestId = `extension-search-${Date.now()}-${extensionPageRequestId += 1}`;

  return new Promise((resolve) => {
    const timerId = setTimeout(() => {
      pendingExtensionPageRequests.delete(requestId);
      void recordTabSearchDebug("background", "search.extension-overlay.timeout", {
        tabId,
        requestId,
        source: candidate?.source || "unknown"
      });
      resolve({ ok: false, error: "options-port-timeout" });
    }, 1200);

    pendingExtensionPageRequests.set(requestId, {
      port,
      resolve,
      timerId
    });

    try {
      void recordTabSearchDebug("background", "search.extension-overlay.requested", {
        tabId,
        requestId,
        source: candidate?.source || "unknown",
        tabCount: Array.isArray(tabs) ? tabs.length : 0
      });
      port.postMessage({
        type: "open-extension-tab-search",
        requestId,
        targetTabId: tabId,
        tabs
      });
    } catch (_error) {
      pendingExtensionPageRequests.delete(requestId);
      clearTimeout(timerId);
      void recordTabSearchDebug("background", "search.extension-overlay.post-failed", { tabId, requestId });
      resolve({ ok: false, error: "options-port-post-failed" });
    }
  });
}

async function organizeTabsWithAI() {
  if (organizationState.busy) {
    return { ok: false, error: "已有一次整理正在进行中。" };
  }

  organizationState = createBusyState();
  pushLog("开始整理当前窗口标签页");

  try {
    updateState({
      phase: "validating",
      title: "检查设置",
      detail: "正在读取接口配置"
    });

    const settings = await getAISettings();

    if (!settings.apiKey) {
      throw new Error("请先在设置页填写 API Key。");
    }

    updateState({
      phase: "reading_tabs",
      title: "读取标签页",
      detail: "正在分析当前窗口的未固定网页标签页"
    });

    const windowTabs = await chrome.tabs.query({ currentWindow: true });
    const candidateTabs = getCandidateTabs(windowTabs);
    pushLog(`读取到 ${candidateTabs.length} 个可整理标签页`);

    if (candidateTabs.length < 2) {
      const reason = "当前窗口至少需要 2 个未固定网页标签页。";
      finishSuccess(reason, { groups: [], ungroupedTabIds: candidateTabs.map((tab) => tab.id) });
      return { ok: true, skipped: true, reason, state: organizationState };
    }

    updateState({
      phase: "requesting_ai",
      title: "请求 AI",
      detail: `正在向 ${new URL(settings.endpoint).hostname} 发送整理请求`
    });

    const rawPlan = await requestAIOrganizationPlan(candidateTabs, settings);
    pushLog("AI 已返回整理方案");

    updateState({
      phase: "validating_plan",
      title: "校验方案",
      detail: "正在确保每个标签页都被安全纳入方案"
    });

    const plan = normalizeOrganizationPlan(rawPlan, candidateTabs);
    pushLog(`校验完成：${plan.groups.length} 个分组`);

    updateState({
      phase: "applying",
      title: "应用方案",
      detail: "正在重新排序标签页并创建分组"
    });

    await applyOrganizationPlan(plan, candidateTabs, windowTabs);

    let renamedCount = 0;

    if (settings.experimentalTitleRewriteEnabled) {
      updateState({
        phase: "rewriting_titles",
        title: "简化标题",
        detail: "正在为较长或难懂的标签标题生成简写"
      });

      try {
        renamedCount = await rewriteTabTitlesWithAI(candidateTabs, settings);

        if (renamedCount > 0) {
          pushLog(`已简化 ${renamedCount} 个标签标题`);
        } else {
          pushLog("没有需要简化的可注入网页标题");
        }
      } catch (error) {
        pushLog(`标题简化已跳过：${error instanceof Error ? error.message : "未知错误"}`);
      }
    }

    const summary = buildPlanSummary(plan, renamedCount);
    finishSuccess(summary, plan);
    return { ok: true, summary, plan, renamedCount, state: organizationState };
  } catch (error) {
    finishError(error instanceof Error ? error.message : "整理失败");
    throw error;
  }
}

async function previewBatchTabs(query) {
  const trimmedQuery = String(query || "").trim();

  if (!trimmedQuery) {
    return { ok: false, error: "请输入自然语言描述。" };
  }

  const settings = await getAISettings();

  if (!settings.apiKey) {
    return { ok: false, error: "请先在设置页填写 API Key。" };
  }

  const currentTabs = getCandidateTabs(await chrome.tabs.query({ currentWindow: true }));

  if (currentTabs.length === 0) {
    return { ok: false, error: "当前窗口没有可操作的网页标签页。" };
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

  if (tabIds.length === 0) {
    return { ok: false, error: "还没有选中任何标签页。" };
  }

  const tabs = await Promise.all(tabIds.map((tabId) => chrome.tabs.get(tabId)));
  const validTabs = tabs.filter((tab) => tab.id);

  if (validTabs.length === 0) {
    return { ok: false, error: "选中的标签页已经不存在了。" };
  }

  if (action === "group") {
    const label = customLabel || deriveBatchLabel(query, validTabs);
    const groupId = await chrome.tabs.group({ tabIds });
    await chrome.tabGroups.update(groupId, {
      title: label,
      color: "grey",
      collapsed: false
    });

    return { ok: true, summary: `已把 ${validTabs.length} 个标签页分到“${label}”` };
  }

  if (action === "delete") {
    await chrome.tabs.remove(tabIds);
    return { ok: true, summary: `已关闭 ${validTabs.length} 个标签页` };
  }

  if (action === "bookmark") {
    const folderId = await ensureBookmarkFolder(customLabel || deriveBatchLabel(query, validTabs));

    for (const tab of validTabs) {
      await chrome.bookmarks.create({
        parentId: folderId,
        title: tab.title || tab.url || "Untitled",
        url: tab.url
      });
    }

    return { ok: true, summary: `已把 ${validTabs.length} 个标签页加入书签` };
  }

  if (action === "bookmark_close") {
    const folderId = await ensureBookmarkFolder(customLabel || deriveBatchLabel(query, validTabs));

    for (const tab of validTabs) {
      if (!tab.url) {
        continue;
      }

      await chrome.bookmarks.create({
        parentId: folderId,
        title: tab.title || tab.url || "Untitled",
        url: tab.url
      });
    }

    await chrome.tabs.remove(validTabs.map((tab) => tab.id));
    return { ok: true, summary: `已收藏并关闭 ${validTabs.length} 个标签页` };
  }

  return { ok: false, error: "不支持的操作。" };
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
    "You select browser tabs from a list based on a natural-language request. Return strict JSON only. Pick only strongly relevant tabs. Output selectedTabIds as an array of numbers, a short rationale string, and a suggestedLabel string. Each tab may include idleMin (integer: minutes since last accessed) — use it for time-based queries like 'not opened in 30 minutes' or 'inactive for an hour'. Tabs without idleMin have unknown access time.",
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
    throw new Error(`AI 请求失败：${response.status} ${truncate(errorText, 140)}`);
  }

  const payload = await response.json();
  const content = extractAssistantContent(payload);

  if (!content) {
    throw new Error("AI 没有返回可解析内容。");
  }

  return parseJsonFromText(content);
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

function normalizeOrganizationPlan(plan, tabs) {
  const validIds = new Set(tabs.map((tab) => tab.id));
  const assignedIds = new Set();
  const normalizedGroups = [];
  const sourceGroups = Array.isArray(plan?.groups) ? plan.groups : [];

  for (const group of sourceGroups) {
    const tabIds = (Array.isArray(group?.tabIds) ? group.tabIds : [])
      .map((value) => Number(value))
      .filter((id) => validIds.has(id) && !assignedIds.has(id));

    if (tabIds.length < 2) {
      continue;
    }

    tabIds.forEach((id) => assignedIds.add(id));
    normalizedGroups.push({
      name: truncate(String(group?.name || "Group").trim() || "Group", 40),
      color: TAB_GROUP_COLORS.includes(group?.color) ? group.color : pickGroupColor(normalizedGroups.length),
      collapsed: Boolean(group?.collapsed),
      tabIds
    });
  }

  const ungroupedTabIds = (Array.isArray(plan?.ungroupedTabIds) ? plan.ungroupedTabIds : [])
    .map((value) => Number(value))
    .filter((id) => validIds.has(id) && !assignedIds.has(id));

  ungroupedTabIds.forEach((id) => assignedIds.add(id));

  for (const tab of tabs) {
    if (!assignedIds.has(tab.id)) {
      ungroupedTabIds.push(tab.id);
      assignedIds.add(tab.id);
    }
  }

  return { groups: normalizedGroups, ungroupedTabIds };
}

function normalizeBatchSelection(result, tabs) {
  const validIds = new Set(tabs.map((tab) => tab.id));
  const selectedIdSet = new Set(
    (Array.isArray(result?.selectedTabIds) ? result.selectedTabIds : [])
      .map((value) => Number(value))
      .filter((id) => validIds.has(id))
  );

  const selectedTabs = tabs.filter((tab) => selectedIdSet.has(tab.id));

  return {
    tabs: selectedTabs,
    rationale: String(result?.rationale || "").trim(),
    suggestedLabel: truncate(String(result?.suggestedLabel || "").trim() || deriveBatchLabel("", selectedTabs), 40)
  };
}

async function applyOrganizationPlan(plan, candidateTabs, allWindowTabs) {
  const pinnedCount = allWindowTabs.filter((tab) => tab.pinned).length;
  const desiredOrder = [...plan.groups.flatMap((group) => group.tabIds), ...plan.ungroupedTabIds];
  const groupedTabs = candidateTabs.filter((tab) => tab.groupId !== -1).map((tab) => tab.id);

  if (groupedTabs.length > 0) {
    pushLog(`先解除 ${groupedTabs.length} 个已有分组内标签页`);
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

function buildPlanSummary(plan, renamedCount = 0) {
  const renameSuffix = renamedCount > 0 ? `，并简化 ${renamedCount} 个标题` : "";

  if (plan.groups.length === 0) {
    return `已整理 ${plan.ungroupedTabIds.length} 个标签页${renameSuffix}`;
  }

  return `已整理 ${plan.groups.length} 个分组，覆盖 ${plan.groups.flatMap((group) => group.tabIds).length} 个标签页${renameSuffix}`;
}

async function getAISettings() {
  const stored = await chrome.storage.local.get([
    "aiEndpoint",
    "aiApiKey",
    "aiModel",
    "aiPreference",
    "experimentalTitleRewriteEnabled"
  ]);

  return {
    endpoint: normalizeEndpoint(stored.aiEndpoint || DEFAULT_AI_ENDPOINT),
    apiKey: stored.aiApiKey || "",
    model: stored.aiModel || DEFAULT_AI_MODEL,
    preference: stored.aiPreference || "",
    experimentalTitleRewriteEnabled: Boolean(stored.experimentalTitleRewriteEnabled)
  };
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
  const folderId = await ensureBookmarkFolder("Search Saves");

  if (tab.url) {
    await chrome.bookmarks.create({
      parentId: folderId,
      title: tab.title || tab.url || "Untitled",
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

  pushLog(`为 ${candidates.length} 个网页尝试生成简写标题`);

  const rawPlan = await requestAITitleRewritePlan(candidates, settings);
  const rewrites = normalizeTitleRewritePlan(rawPlan, candidates);
  const results = await Promise.all(rewrites.map((rewrite) => applyTemporaryTitleRewrite(rewrite.tabId, rewrite.title)));
  return results.filter(Boolean).length;
}

function normalizeTitleRewritePlan(result, tabs) {
  const validIds = new Set(tabs.map((tab) => tab.id));
  const seenIds = new Set();
  const tabsById = new Map(tabs.map((tab) => [tab.id, tab]));
  const source = Array.isArray(result?.titles) ? result.titles : [];

  return source
    .map((item) => ({
      tabId: Number(item?.tabId),
      title: cleanupRewrittenTitle(
        truncate(String(item?.rewrittenTitle || "").trim(), TITLE_REWRITE_MAX_LENGTH),
        tabsById.get(Number(item?.tabId))
      )
    }))
    .filter((item) => {
      if (!validIds.has(item.tabId) || seenIds.has(item.tabId) || !item.title) {
        return false;
      }

      seenIds.add(item.tabId);
      return true;
    });
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
          window.clearInterval(owner[key]);
          owner[key] = null;
        }

        const characters = Array.from(normalized);

        if (characters.length === 0) {
          return false;
        }

        document.title = "";

        return new Promise((resolve) => {
          owner[key] = window.setTimeout(() => {
            owner[key] = null;
            document.title = normalized;
            resolve(document.title === normalized);
          }, 24);
        });
      },
      args: [title]
    });

    return true;
  } catch (_error) {
    return false;
  }
}

function cleanupRewrittenTitle(title, tab) {
  const normalized = String(title || "")
    .replace(/\s*[|·•\-—]\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) {
    return "";
  }

  const domain = safeGetDomain(tab?.url || "")
    .replace(/^www\./i, "")
    .split(".")[0]
    .toLowerCase();

  if (!domain) {
    return normalized;
  }

  const parts = normalized.split(/\s+/).filter((part) => part.toLowerCase() !== domain);
  return truncate(parts.join(" ").trim() || normalized, TITLE_REWRITE_MAX_LENGTH);
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
    throw new Error("找不到可用的书签根目录。");
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

function createIdleState() {
  return {
    busy: false,
    phase: "idle",
    title: "等待开始",
    detail: "准备好后点击“开始整理”",
    logs: [],
    summary: "",
    error: "",
    updatedAt: Date.now(),
    lastPlan: null
  };
}

function createBusyState() {
  return {
    busy: true,
    phase: "starting",
    title: "准备开始",
    detail: "正在启动整理流程",
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

function pushLog(message) {
  const logs = [...organizationState.logs, { message, at: new Date().toLocaleTimeString("zh-CN", { hour12: false }) }];
  updateState({ logs: logs.slice(-12) });
}

function finishSuccess(summary, plan) {
  pushLog(summary);
  updateState({
    busy: false,
    phase: "done",
    title: "整理完成",
    detail: summary,
    summary,
    error: "",
    lastPlan: plan
  });
}

function finishError(message) {
  pushLog(`失败：${message}`);
  updateState({
    busy: false,
    phase: "error",
    title: "整理失败",
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

function parseJsonFromText(text) {
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

    throw new Error("AI 返回的不是合法 JSON。");
  }
}

function normalizeEndpoint(endpoint) {
  const value = String(endpoint || "").trim();

  if (!value) {
    return DEFAULT_AI_ENDPOINT;
  }

  try {
    const url = new URL(value);

    if (url.pathname === "/" || url.pathname === "" || url.pathname === "/v1" || url.pathname === "/v1/") {
      url.pathname = "/v1/chat/completions";
    }

    return url.toString();
  } catch (_error) {
    return value;
  }
}

function safeGetDomain(url) {
  try {
    return new URL(url).hostname;
  } catch (_error) {
    return "";
  }
}

function pickGroupColor(index) {
  return TAB_GROUP_COLORS[index % TAB_GROUP_COLORS.length];
}

function truncate(value, maxLength) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
}

function deriveBatchLabel(query, tabs) {
  const normalized = String(query || "").trim();

  if (normalized) {
    return truncate(normalized, 40);
  }

  const firstDomain = safeGetDomain(tabs[0]?.url || "");
  return firstDomain || "Arc Tabs";
}

function getCandidateTabs(tabs) {
  return tabs.filter((tab) => !tab.pinned && tab.id);
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
