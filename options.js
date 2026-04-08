const {
  AI_PROVIDER_STORAGE_KEY,
  CUSTOM_AI_MODEL_OPTION_VALUE,
  applyAIProviderPreset,
  detectAIProviderPreset,
  normalizeAIEndpoint,
  populateAIModelSelect,
  populateAIProviderSelect,
  resolveAIModelSelection,
  resolveAISettingsDraft,
  updateAIKeyPlaceholder
} = globalThis.AIProviderConfig;

const providerSelect = document.getElementById("provider-select");
const endpointInput = document.getElementById("endpoint-input");
const apiKeyInput = document.getElementById("api-key-input");
const modelSelect = document.getElementById("model-select");
const modelInput = document.getElementById("model-input");
const preferenceInput = document.getElementById("preference-input");
const titleRewriteInput = document.getElementById("title-rewrite-input");
const saveButton = document.getElementById("save-button");
const runButton = document.getElementById("run-button");
const statusText = document.getElementById("status-text");
const modeToggle = document.getElementById("mode-toggle");
const swatches = document.querySelectorAll(".theme-swatch");

initialize();

populateAIProviderSelect(providerSelect);
populateAIModelSelect(modelSelect, providerSelect.value, "");

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

providerSelect.addEventListener("change", () => {
  const nextDraft = applyAIProviderPreset(providerSelect.value, {
    endpoint: endpointInput.value,
    apiKey: apiKeyInput.value,
    model: getCurrentModelValue(),
    preference: preferenceInput.value,
    experimentalTitleRewriteEnabled: titleRewriteInput.checked
  });

  endpointInput.value = nextDraft.endpoint;
  syncModelControls(nextDraft.providerId, nextDraft.model);
  updateAIKeyPlaceholder(apiKeyInput, nextDraft.providerId);
});

endpointInput.addEventListener("input", () => {
  providerSelect.value = detectAIProviderPreset(endpointInput.value);
  syncModelControls(providerSelect.value, getCurrentModelValue());
  updateAIKeyPlaceholder(apiKeyInput, providerSelect.value);
});

modelSelect.addEventListener("change", () => {
  const isCustom = modelSelect.value === CUSTOM_AI_MODEL_OPTION_VALUE;

  if (isCustom && !modelInput.value.trim()) {
    modelInput.value = modelSelect.dataset.selectedPresetModel || "";
  }

  if (!isCustom) {
    modelSelect.dataset.selectedPresetModel = modelSelect.value;
  }

  modelInput.classList.toggle("hidden", !isCustom);
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
    AI_PROVIDER_STORAGE_KEY,
    "aiEndpoint",
    "aiApiKey",
    "aiModel",
    "aiPreference",
    "experimentalTitleRewriteEnabled",
    "themeColor",
    "themeMode"
  ]);

  const draft = resolveAISettingsDraft(stored);
  providerSelect.value = draft.providerId;
  endpointInput.value = draft.endpoint;
  apiKeyInput.value = draft.apiKey;
  syncModelControls(draft.providerId, draft.model);
  preferenceInput.value = draft.preference;
  titleRewriteInput.checked = draft.experimentalTitleRewriteEnabled;
  updateAIKeyPlaceholder(apiKeyInput, draft.providerId);
  updateSwatchSelection(stored.themeColor || "neutral");
  updateModeToggle(stored.themeMode || "light");
}

async function saveSettings() {
  const endpoint = normalizeAIEndpoint(endpointInput.value);

  await chrome.storage.local.set({
    [AI_PROVIDER_STORAGE_KEY]: providerSelect.value,
    aiEndpoint: endpoint,
    aiApiKey: apiKeyInput.value.trim(),
    aiModel: getCurrentModelValue(),
    aiPreference: preferenceInput.value.trim(),
    experimentalTitleRewriteEnabled: titleRewriteInput.checked
  });

  endpointInput.value = endpoint;
}

function syncModelControls(providerId, modelValue) {
  const selection = resolveAIModelSelection(providerId, modelValue);
  populateAIModelSelect(modelSelect, providerId, modelValue);
  modelSelect.value = selection.selectedValue;
  modelSelect.dataset.selectedPresetModel =
    selection.selectedValue === CUSTOM_AI_MODEL_OPTION_VALUE ? selection.options[0]?.value || "" : selection.selectedValue;
  modelInput.value = selection.customValue;
  modelInput.classList.toggle("hidden", selection.selectedValue !== CUSTOM_AI_MODEL_OPTION_VALUE);
}

function getCurrentModelValue() {
  return modelSelect.value === CUSTOM_AI_MODEL_OPTION_VALUE ? modelInput.value.trim() : modelSelect.value;
}

function setBusy(busy, message) {
  saveButton.disabled = busy;
  runButton.disabled = busy;
  statusText.textContent = message;
}
