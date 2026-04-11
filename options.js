(() => {
const i18n = globalThis.AITabI18n;
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
const languageSelect = document.getElementById("language-select");
const preferenceInput = document.getElementById("preference-input");
const titleRewriteInput = document.getElementById("title-rewrite-input");
const saveButton = document.getElementById("save-button");
const runButton = document.getElementById("run-button");
const statusText = document.getElementById("status-text");
const modeToggle = document.getElementById("mode-toggle");
const swatches = document.querySelectorAll(".theme-swatch");

let currentLocale = i18n?.DEFAULT_UI_LANGUAGE || "cn";

initialize();

i18n.getLanguageOptions().forEach((option) => {
  const node = document.createElement("option");
  node.value = option.value;
  node.textContent = option.label;
  languageSelect.appendChild(node);
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

languageSelect.addEventListener("change", () => {
  currentLocale = i18n.resolveUILanguage(languageSelect.value);
  renderLocale();
});

providerSelect.addEventListener("change", () => {
  const nextDraft = applyAIProviderPreset(providerSelect.value, {
    endpoint: endpointInput.value,
    apiKey: apiKeyInput.value,
    model: getCurrentModelValue(),
    preference: preferenceInput.value,
    experimentalTitleRewriteEnabled: titleRewriteInput.checked,
    uiLanguage: currentLocale
  }, currentLocale);

  endpointInput.value = nextDraft.endpoint;
  syncModelControls(nextDraft.providerId, nextDraft.model);
  updateAIKeyPlaceholder(apiKeyInput, nextDraft.providerId, currentLocale);
});

endpointInput.addEventListener("input", () => {
  providerSelect.value = detectAIProviderPreset(endpointInput.value);
  syncModelControls(providerSelect.value, getCurrentModelValue());
  updateAIKeyPlaceholder(apiKeyInput, providerSelect.value, currentLocale);
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
  setBusy(true, i18n.t(currentLocale, "saving"));

  try {
    await saveSettings();
    setBusy(false, i18n.t(currentLocale, "saved"));
  } catch (error) {
    setBusy(false, error instanceof Error ? error.message : i18n.t(currentLocale, "saveFailed"));
  }
});

runButton.addEventListener("click", async () => {
  setBusy(true, i18n.t(currentLocale, "saveAndStart"));

  try {
    await saveSettings();
    const response = await chrome.runtime.sendMessage({ type: "run-ai-organization" });

    if (!response?.ok && !response?.skipped) {
      throw new Error(response?.error || i18n.t(currentLocale, "organizeFailed"));
    }

    setBusy(false, response?.summary || response?.reason || i18n.t(currentLocale, "started"));
  } catch (error) {
    setBusy(false, error instanceof Error ? error.message : i18n.t(currentLocale, "organizeFailed"));
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
    "themeMode",
    i18n.UI_LANGUAGE_STORAGE_KEY
  ]);

  const draft = resolveAISettingsDraft(stored, stored[i18n.UI_LANGUAGE_STORAGE_KEY]);
  currentLocale = draft.uiLanguage;
  languageSelect.value = currentLocale;
  providerSelect.value = draft.providerId;
  endpointInput.value = draft.endpoint;
  apiKeyInput.value = draft.apiKey;
  syncModelControls(draft.providerId, draft.model);
  preferenceInput.value = draft.preference;
  titleRewriteInput.checked = draft.experimentalTitleRewriteEnabled;
  updateSwatchSelection(stored.themeColor || "neutral");
  updateModeToggle(stored.themeMode || "light");
  renderLocale();
  updateAIKeyPlaceholder(apiKeyInput, draft.providerId, currentLocale);
}

async function saveSettings() {
  const endpoint = normalizeAIEndpoint(endpointInput.value);

  await chrome.storage.local.set({
    [AI_PROVIDER_STORAGE_KEY]: providerSelect.value,
    aiEndpoint: endpoint,
    aiApiKey: apiKeyInput.value.trim(),
    aiModel: getCurrentModelValue(),
    aiPreference: preferenceInput.value.trim(),
    experimentalTitleRewriteEnabled: titleRewriteInput.checked,
    [i18n.UI_LANGUAGE_STORAGE_KEY]: currentLocale
  });

  endpointInput.value = endpoint;
}

function syncModelControls(providerId, modelValue) {
  const selection = resolveAIModelSelection(providerId, modelValue);
  populateAIModelSelect(modelSelect, providerId, modelValue, currentLocale);
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

function renderLocale() {
  const providerId = providerSelect.value || "openai";
  const modelValue = getCurrentModelValue();
  document.documentElement.lang = i18n.getLocaleTag(currentLocale);
  document.title = `Arc Tabs ${i18n.t(currentLocale, "settings")}`;
  document.getElementById("settings-page-title").textContent = i18n.t(currentLocale, "settings");
  document.getElementById("provider-label").textContent = i18n.t(currentLocale, "provider");
  document.getElementById("endpoint-label").textContent = i18n.t(currentLocale, "endpoint");
  document.getElementById("api-key-label").textContent = i18n.t(currentLocale, "apiKey");
  document.getElementById("model-label").textContent = i18n.t(currentLocale, "modelName");
  document.getElementById("language-label").textContent = i18n.t(currentLocale, "language");
  document.getElementById("provider-helper").textContent = i18n.t(currentLocale, "providerHelper");
  document.getElementById("preference-label").textContent = i18n.t(currentLocale, "preference");
  document.getElementById("title-rewrite-label").textContent = i18n.t(currentLocale, "titleRewriteLabel");
  document.getElementById("title-rewrite-helper").textContent = i18n.t(currentLocale, "titleRewriteHelper");
  saveButton.textContent = i18n.t(currentLocale, "saveSettings");
  runButton.textContent = i18n.t(currentLocale, "saveAndRun");
  preferenceInput.placeholder = i18n.t(currentLocale, "preferencePlaceholder");
  modelInput.placeholder = i18n.t(currentLocale, "customModelPlaceholder");
  modeToggle.title = i18n.t(currentLocale, "modeToggleTitle");

  const themeOptions = new Map(i18n.getThemeOptions(currentLocale).map((item) => [item.key, item.label]));
  swatches.forEach((swatch) => {
    swatch.title = themeOptions.get(swatch.dataset.color) || swatch.dataset.color;
  });

  populateAIProviderSelect(providerSelect, currentLocale);
  providerSelect.value = providerId;
  syncModelControls(providerId, modelValue);
  updateAIKeyPlaceholder(apiKeyInput, providerId, currentLocale);
}
})();
