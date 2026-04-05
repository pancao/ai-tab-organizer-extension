const runButton = document.getElementById("run-button");
const settingsButton = document.getElementById("settings-button");
const organizeShortcut = document.getElementById("organize-shortcut");
const searchShortcut = document.getElementById("search-shortcut");
const popupHome = document.getElementById("popup-home");
const popupSettingsView = document.getElementById("popup-settings-view");
const popupResultView = document.getElementById("popup-result-view");
const viewResultButton = document.getElementById("view-result-button");
const backButton = document.getElementById("back-button");
const detailSummary = document.getElementById("detail-summary");
const groupList = document.getElementById("group-list");

const settingsBackButton = document.getElementById("settings-back-button");
const endpointInput = document.getElementById("endpoint-input");
const apiKeyInput = document.getElementById("api-key-input");
const modelInput = document.getElementById("model-input");
const preferenceInput = document.getElementById("preference-input");
const titleRewriteInput = document.getElementById("title-rewrite-input");
const saveButton = document.getElementById("save-button");
const saveRunButton = document.getElementById("save-run-button");
const settingsStatusText = document.getElementById("settings-status-text");

let pollTimer = null;
let lastPlan = null;
let lastSummary = "暂无结果";

initialize();

runButton.addEventListener("click", async () => {
  setRunBusy(true);

  try {
    const response = await chrome.runtime.sendMessage({ type: "run-ai-organization" });

    if (!response?.ok && !response?.skipped) {
      throw new Error(response?.error || "整理失败");
    }
  } catch (error) {
    console.error(error);
  } finally {
    await refreshState();
  }
});

settingsButton.addEventListener("click", async () => {
  showPage("settings");
  await loadSettingsIntoForm();
});

settingsBackButton.addEventListener("click", () => {
  showPage("home");
});

saveButton.addEventListener("click", async () => {
  setSettingsBusy(true, "正在保存…");

  try {
    await saveSettings();
    setSettingsBusy(false, "已保存");
  } catch (error) {
    setSettingsBusy(false, error instanceof Error ? error.message : "保存失败");
  }
});

saveRunButton.addEventListener("click", async () => {
  setSettingsBusy(true, "保存并开始整理…");

  try {
    await saveSettings();
    const response = await chrome.runtime.sendMessage({ type: "run-ai-organization" });

    if (!response?.ok && !response?.skipped) {
      throw new Error(response?.error || "整理失败");
    }

    setSettingsBusy(false, response?.summary || response?.reason || "已开始");
    showPage("home");
    setRunBusy(true);
  } catch (error) {
    setSettingsBusy(false, error instanceof Error ? error.message : "整理失败");
  }
});

viewResultButton.addEventListener("click", () => {
  if (!lastPlan) {
    return;
  }

  showPage("result");
});

backButton.addEventListener("click", () => {
  showPage("home");
});

async function initialize() {
  await renderShortcuts();
  await refreshState();
  pollTimer = window.setInterval(refreshState, 500);
}

window.addEventListener("unload", () => {
  if (pollTimer) {
    window.clearInterval(pollTimer);
  }
});

async function refreshState() {
  const response = await chrome.runtime.sendMessage({ type: "get-organization-state" });

  if (!response?.ok) {
    return;
  }

  renderState(response.state);
}

function renderState(state) {
  setRunBusy(Boolean(state.busy));
  renderPlan(state.summary, state.lastPlan);
}

function renderPlan(summary, plan) {
  lastPlan = plan || null;
  lastSummary = summary || "暂无结果";
  detailSummary.textContent = lastSummary;
  viewResultButton.disabled = !plan || (!(plan.groups?.length) && !(plan.ungroupedTabIds?.length));
  groupList.textContent = "";

  if (!plan || (!plan.groups?.length && !plan.ungroupedTabIds?.length)) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "还没有可查看的整理结果";
    groupList.appendChild(empty);
    return;
  }

  (plan.groups || []).forEach((group) => {
    const item = document.createElement("div");
    item.className = "group-item";

    const name = document.createElement("div");
    name.className = "group-name";
    name.textContent = group.name;

    const meta = document.createElement("div");
    meta.className = "group-meta";
    meta.textContent = `${group.tabIds.length} 个标签页`;

    item.appendChild(name);
    item.appendChild(meta);
    groupList.appendChild(item);
  });

  if (plan.ungroupedTabIds?.length) {
    const item = document.createElement("div");
    item.className = "group-item";

    const name = document.createElement("div");
    name.className = "group-name";
    name.textContent = "未分组";

    const meta = document.createElement("div");
    meta.className = "group-meta";
    meta.textContent = `${plan.ungroupedTabIds.length} 个标签页`;

    item.appendChild(name);
    item.appendChild(meta);
    groupList.appendChild(item);
  }
}

function showPage(page) {
  popupHome.classList.toggle("hidden", page !== "home");
  popupSettingsView.classList.toggle("hidden", page !== "settings");
  popupResultView.classList.toggle("hidden", page !== "result");
}

function setRunBusy(busy) {
  runButton.disabled = busy;
  runButton.textContent = busy ? "整理中…" : "一键整理标签页";
  runButton.classList.toggle("loading-button", busy);
}

async function renderShortcuts() {
  try {
    const commands = await chrome.commands.getAll();
    const organizeCommand = commands.find((item) => item.name === "organize-tabs-ai");
    const searchCommand = commands.find((item) => item.name === "search-tabs");

    organizeShortcut.textContent = formatShortcut(organizeCommand?.shortcut, "⌘⇧J");
    searchShortcut.textContent = formatShortcut(searchCommand?.shortcut, "⌘⇧K");
  } catch (_error) {
    organizeShortcut.textContent = "⌘⇧J";
    searchShortcut.textContent = "⌘⇧K";
  }
}

async function loadSettingsIntoForm() {
  const stored = await chrome.storage.local.get([
    "aiEndpoint",
    "aiApiKey",
    "aiModel",
    "aiPreference",
    "experimentalTitleRewriteEnabled"
  ]);

  endpointInput.value = normalizeEndpoint(stored.aiEndpoint || "https://api.openai.com/v1/chat/completions");
  apiKeyInput.value = stored.aiApiKey || "";
  modelInput.value = stored.aiModel || "gpt-4.1-mini";
  preferenceInput.value = stored.aiPreference || "";
  titleRewriteInput.checked = Boolean(stored.experimentalTitleRewriteEnabled);
  settingsStatusText.textContent = "";
}

async function saveSettings() {
  const endpoint = normalizeEndpoint(endpointInput.value);

  await chrome.storage.local.set({
    aiEndpoint: endpoint,
    aiApiKey: apiKeyInput.value.trim(),
    aiModel: modelInput.value.trim(),
    aiPreference: preferenceInput.value.trim(),
    experimentalTitleRewriteEnabled: titleRewriteInput.checked
  });

  endpointInput.value = endpoint;
}

function setSettingsBusy(busy, message) {
  saveButton.disabled = busy;
  saveRunButton.disabled = busy;
  settingsStatusText.textContent = message;
}

function normalizeEndpoint(endpoint) {
  const value = String(endpoint || "").trim();

  if (!value) {
    return "https://api.openai.com/v1/chat/completions";
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

function formatShortcut(value, fallback) {
  if (!value) {
    return fallback;
  }

  return value
    .replace(/Command/gi, "⌘")
    .replace(/Ctrl/gi, "⌃")
    .replace(/Shift/gi, "⇧")
    .replace(/Alt/gi, "⌥")
    .replace(/\+/g, "");
}
