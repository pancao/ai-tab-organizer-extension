const runButton = document.getElementById("run-button");
const searchButton = document.getElementById("search-button");
const settingsButton = document.getElementById("settings-button");
const organizeShortcut = document.getElementById("organize-shortcut");
const searchShortcut = document.getElementById("search-shortcut");

let pollTimer = null;

// Fire-and-forget: don't await so popup renders immediately
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
  await chrome.runtime.openOptionsPage();
  window.close();
});

async function initialize() {
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
