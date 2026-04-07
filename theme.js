async function applyTheme() {
  const { themeColor, themeMode } = await chrome.storage.local.get(["themeColor", "themeMode"]);
  document.documentElement.dataset.themeColor = themeColor || "neutral";
  document.documentElement.dataset.themeMode = themeMode || "light";
}

applyTheme();

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes.themeColor) {
    document.documentElement.dataset.themeColor = changes.themeColor.newValue || "neutral";
  }
  if (changes.themeMode) {
    document.documentElement.dataset.themeMode = changes.themeMode.newValue || "light";
  }
});
