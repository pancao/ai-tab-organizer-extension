const i18n = globalThis.AITabI18n;
const runButton = document.getElementById("run-button");
const searchButton = document.getElementById("search-button");
const settingsButton = document.getElementById("settings-button");
const organizeShortcut = document.getElementById("organize-shortcut");
const searchShortcut = document.getElementById("search-shortcut");

let pollTimer = null;
let currentLocale = i18n.DEFAULT_UI_LANGUAGE;

initialize();

runButton.addEventListener("click", async () => {
  setRunBusy(true);

  try {
    const response = await chrome.runtime.sendMessage({ type: "run-ai-organization" });

    if (!response?.ok && !response?.skipped) {
      throw new Error(response?.error || i18n.t(currentLocale, "organizeFailed"));
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
  await chrome.runtime.openOptionsPage();
  window.close();
});

async function initialize() {
  currentLocale = await i18n.getStoredLanguage();
  renderLocale();
  await Promise.all([renderShortcuts(), refreshState()]);
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

function setRunBusy(busy) {
  runButton.disabled = busy;
  runButton.textContent = busy ? i18n.t(currentLocale, "popupRunBusy") : i18n.t(currentLocale, "organizeAllTabs");
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

function renderLocale() {
  document.documentElement.lang = i18n.getLocaleTag(currentLocale);
  document.getElementById("shortcut-title").textContent = i18n.t(currentLocale, "shortcutKeys");
  document.getElementById("organize-shortcut-label").textContent = i18n.t(currentLocale, "organizeTabs");
  document.getElementById("search-shortcut-label").textContent = i18n.t(currentLocale, "searchTabs");
  searchButton.textContent = i18n.t(currentLocale, "openSearchPanel");
  settingsButton.textContent = i18n.t(currentLocale, "settings");
  setRunBusy(false);
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
