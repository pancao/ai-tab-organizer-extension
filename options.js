const endpointInput = document.getElementById("endpoint-input");
const apiKeyInput = document.getElementById("api-key-input");
const modelInput = document.getElementById("model-input");
const preferenceInput = document.getElementById("preference-input");
const titleRewriteInput = document.getElementById("title-rewrite-input");
const saveButton = document.getElementById("save-button");
const runButton = document.getElementById("run-button");
const statusText = document.getElementById("status-text");
const modeToggle = document.getElementById("mode-toggle");
const swatches = document.querySelectorAll(".theme-swatch");

initialize();

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

saveButton.addEventListener("click", async () => {
  setBusy(true, "正在保存…");

  try {
    await saveSettings();
    setBusy(false, "已保存");
  } catch (error) {
    setBusy(false, error instanceof Error ? error.message : "保存失败");
  }
});

runButton.addEventListener("click", async () => {
  setBusy(true, "保存并开始整理…");

  try {
    await saveSettings();
    const response = await chrome.runtime.sendMessage({ type: "run-ai-organization" });

    if (!response?.ok && !response?.skipped) {
      throw new Error(response?.error || "整理失败");
    }

    setBusy(false, response?.summary || response?.reason || "已开始");
  } catch (error) {
    setBusy(false, error instanceof Error ? error.message : "整理失败");
  }
});

async function initialize() {
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

function setBusy(busy, message) {
  saveButton.disabled = busy;
  runButton.disabled = busy;
  statusText.textContent = message;
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
