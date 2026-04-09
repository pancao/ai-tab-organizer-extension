// Apply theme synchronously with defaults first, then correct from storage
document.documentElement.dataset.themeColor = "neutral";
document.documentElement.dataset.themeMode = "light";

chrome.storage.local.get(["themeColor", "themeMode"]).then(({ themeColor, themeMode }) => {
  document.documentElement.dataset.themeColor = themeColor || "neutral";
  document.documentElement.dataset.themeMode = themeMode || "light";
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes.themeColor) {
    document.documentElement.dataset.themeColor = changes.themeColor.newValue || "neutral";
  }
  if (changes.themeMode) {
    document.documentElement.dataset.themeMode = changes.themeMode.newValue || "light";
  }
});
