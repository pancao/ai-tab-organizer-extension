const runButton = document.getElementById("run-button");
const searchButton = document.getElementById("search-button");
const settingsButton = document.getElementById("settings-button");
const organizeShortcut = document.getElementById("organize-shortcut");
const searchShortcut = document.getElementById("search-shortcut");
const popupHome = document.getElementById("popup-home");
const popupSettingsView = document.getElementById("popup-settings-view");

const settingsBackButton = document.getElementById("settings-back-button");
const modeToggle = document.getElementById("mode-toggle");
const swatches = document.querySelectorAll(".theme-swatch");
const endpointInput = document.getElementById("endpoint-input");
const apiKeyInput = document.getElementById("api-key-input");
const modelInput = document.getElementById("model-input");
const preferenceInput = document.getElementById("preference-input");
const titleRewriteInput = document.getElementById("title-rewrite-input");
const saveButton = document.getElementById("save-button");
const saveRunButton = document.getElementById("save-run-button");
const settingsStatusText = document.getElementById("settings-status-text");

let pollTimer = null;

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

searchButton.addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ type: "run-tab-search" });
  window.close();
});

settingsButton.addEventListener("click", async () => {
  showPage("settings");
  await loadSettingsIntoForm();
});

swatches.forEach((swatch) => {
  swatch.addEventListener("click", async () => {
    const color = swatch.dataset.color;
    await chrome.storage.local.set({ themeColor: color });
    document.documentElement.dataset.themeColor = color;
    updateSwatchSelection(color);
  });
});

modeToggle.addEventListener("click", async () => {
  const current = document.documentElement.dataset.themeMode || "light";
  const next = current === "light" ? "dark" : "light";
  await chrome.storage.local.set({ themeMode: next });
  document.documentElement.dataset.themeMode = next;
  updateModeToggle(next);
});

function updateSwatchSelection(color) {
  swatches.forEach((s) => {
    s.setAttribute("aria-pressed", s.dataset.color === color ? "true" : "false");
  });
}

function updateModeToggle(mode) {
  modeToggle.dataset.mode = mode;
}

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

  setRunBusy(Boolean(response.state.busy));
}

function showPage(page) {
  popupHome.classList.toggle("hidden", page !== "home");
  popupSettingsView.classList.toggle("hidden", page !== "settings");
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
    "experimentalTitleRewriteEnabled",
    "themeColor",
    "themeMode"
  ]);

  endpointInput.value = normalizeEndpoint(stored.aiEndpoint || "https://api.openai.com/v1/chat/completions");
  apiKeyInput.value = stored.aiApiKey || "";
  modelInput.value = stored.aiModel || "gpt-4.1-mini";
  preferenceInput.value = stored.aiPreference || "";
  titleRewriteInput.checked = Boolean(stored.experimentalTitleRewriteEnabled);
  settingsStatusText.textContent = "";
  updateSwatchSelection(stored.themeColor || "neutral");
  updateModeToggle(stored.themeMode || "light");
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
