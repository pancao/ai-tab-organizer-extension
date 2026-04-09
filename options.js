(function initializeOptionsPageScript() {
const {
  EXTENSION_PAGE_SEARCH_CHANNEL_NAME,
  EXTENSION_PAGE_SEARCH_REQUEST_STORAGE_KEY,
  EXTENSION_PAGE_SEARCH_RESPONSE_STORAGE_KEY,
  OPTIONS_PAGE_SEARCH_HASH_PREFIX,
  OPTIONS_PAGE_SEARCH_HASH_RESPONSE_STORAGE_KEY,
  EXTENSION_PAGE_PORT_NAME,
  TAB_SEARCH_DEBUG_STORAGE_KEY,
  AI_PROVIDER_STORAGE_KEY,
  CUSTOM_AI_MODEL_OPTION_VALUE,
  applyAIProviderPreset,
  clearTabSearchDebugEvents,
  detectAIProviderPreset,
  formatTabSearchDebugEvent,
  normalizeAIEndpoint,
  populateAIModelSelect,
  populateAIProviderSelect,
  readTabSearchDebugEvents,
  recordTabSearchDebug,
  resolveAIModelSelection,
  resolveAISettingsDraft,
  updateAIKeyPlaceholder
} = {
  ...globalThis.TabSearchDebug,
  ...globalThis.TabSearchRouting,
  ...globalThis.AIProviderConfig
};

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
const refreshDebugButton = document.getElementById("refresh-debug-button");
const copyDebugButton = document.getElementById("copy-debug-button");
const clearDebugButton = document.getElementById("clear-debug-button");
const debugLogOutput = document.getElementById("debug-log-output");
const debugSection = document.getElementById("debug-section");
const debugToggleButton = document.getElementById("debug-toggle-button");
let extensionPageChannel = null;
let extensionPagePort = null;
let extensionPageReconnectTimerId = null;
let optionsPageHashHandlingAttached = false;
const debugUiEnabled = isDebugUiEnabled();
let debugPanelOpen = false;

window.addEventListener("error", (event) => {
  const details = {
    message: event.message || "Unknown error",
    file: event.filename || "",
    line: event.lineno || null,
    column: event.colno || null
  };
  console.error("Options page error:", event.error || event.message || event);
  void recordOptionsDebug("window.error", details);
});

window.addEventListener("unhandledrejection", (event) => {
  const reason = event.reason instanceof Error
    ? { message: event.reason.message, stack: event.reason.stack || "" }
    : { message: String(event.reason || "Unknown rejection") };
  console.error("Options page rejection:", event.reason);
  void recordOptionsDebug("window.unhandledrejection", reason);
});

void bootstrapOptionsPage();
initializeDebugUi();

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local") {
    return;
  }

  if (changes[TAB_SEARCH_DEBUG_STORAGE_KEY]) {
    void refreshDebugOutput();
  }

  const request = changes[EXTENSION_PAGE_SEARCH_REQUEST_STORAGE_KEY]?.newValue;

  if (request?.requestId) {
    void handleStorageExtensionTabSearchRequest(request);
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "open-extension-tab-search") {
    return undefined;
  }

  handleRuntimeExtensionTabSearchMessage(message)
    .then((result) => sendResponse(result))
    .catch((error) => {
      const messageText = error instanceof Error ? error.message : "Unknown error";
      void recordOptionsDebug("search.runtime.error", { error: messageText });
      sendResponse({ ok: false, error: messageText });
    });

  return true;
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

refreshDebugButton?.addEventListener("click", async () => {
  await refreshDebugOutput();
  statusText.textContent = "调试日志已刷新";
});

copyDebugButton?.addEventListener("click", async () => {
  const text = debugLogOutput?.textContent || "";
  await navigator.clipboard.writeText(text);
  statusText.textContent = "调试日志已复制";
});

clearDebugButton?.addEventListener("click", async () => {
  await clearTabSearchDebugEvents();
  await refreshDebugOutput();
  statusText.textContent = "调试日志已清空";
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

async function bootstrapOptionsPage() {
  try {
    await recordOptionsDebug("bootstrap.start", {
      href: location.href
    });

    populateAIProviderSelect(providerSelect);
    populateAIModelSelect(modelSelect, providerSelect.value, "");
    attachOptionsPageHashSearchHandling();
    connectExtensionPageChannel();
    connectExtensionPagePort("initial");
    await initialize();
    await recordOptionsDebug("bootstrap.ready", {
      href: location.href
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "设置页初始化失败";
    console.error("Failed to bootstrap options page:", error);
    statusText.textContent = message;
    await recordOptionsDebug("bootstrap.error", {
      message,
      stack: error instanceof Error ? error.stack || "" : ""
    });
  }
}

function initializeDebugUi() {
  if (!debugUiEnabled) {
    debugSection?.classList.add("hidden");
    debugToggleButton?.classList.add("hidden");
    return;
  }

  debugToggleButton?.classList.remove("hidden");
  debugToggleButton?.addEventListener("click", () => {
    debugPanelOpen = !debugPanelOpen;
    renderDebugVisibility();
  });

  if (new URLSearchParams(location.search).get("debug") === "1") {
    debugPanelOpen = true;
  }

  renderDebugVisibility();
}

function renderDebugVisibility() {
  debugSection?.classList.toggle("hidden", !debugPanelOpen);

  if (debugToggleButton) {
    debugToggleButton.textContent = debugPanelOpen ? "收起调试" : "调试";
  }
}

function isDebugUiEnabled() {
  const manifest = chrome.runtime?.getManifest?.() || {};
  const forceDebug = new URLSearchParams(location.search).get("debug") === "1";
  return forceDebug || !Object.prototype.hasOwnProperty.call(manifest, "update_url");
}

function connectExtensionPageChannel() {
  if (typeof BroadcastChannel !== "function") {
    void recordOptionsDebug("channel.unavailable", {
      channelName: EXTENSION_PAGE_SEARCH_CHANNEL_NAME
    });
    return;
  }

  if (extensionPageChannel) {
    extensionPageChannel.close();
  }

  const channel = new BroadcastChannel(EXTENSION_PAGE_SEARCH_CHANNEL_NAME);
  extensionPageChannel = channel;

  void recordOptionsDebug("channel.connected", {
    channelName: EXTENSION_PAGE_SEARCH_CHANNEL_NAME
  });

  channel.addEventListener("message", (event) => {
    const message = event?.data;

    if (message?.type !== "open-extension-tab-search") {
      return;
    }

    void recordOptionsDebug("search.channel.received", {
      requestId: message.requestId,
      targetTabId: message.targetTabId
    });

    handleExtensionTabSearchMessage(message)
      .then((handled) => {
        channel.postMessage({
          type: "open-extension-tab-search-result",
          requestId: message.requestId,
          ok: handled,
          error: handled ? "" : "options-overlay-skipped"
        });
        return recordOptionsDebug("search.channel.result", {
          requestId: message.requestId,
          ok: handled
        });
      })
      .catch((error) => {
        const messageText = error instanceof Error ? error.message : "Unknown error";
        channel.postMessage({
          type: "open-extension-tab-search-result",
          requestId: message.requestId,
          ok: false,
          error: messageText
        });
        return recordOptionsDebug("search.channel.error", {
          requestId: message.requestId,
          error: messageText
        });
      });
  });
}

function attachOptionsPageHashSearchHandling() {
  if (optionsPageHashHandlingAttached) {
    return;
  }

  window.addEventListener("hashchange", () => {
    void handleOptionsPageHashSearch();
  });
  optionsPageHashHandlingAttached = true;
  void handleOptionsPageHashSearch();
}

async function handleOptionsPageHashSearch() {
  const currentHash = String(location.hash || "");

  if (!currentHash.startsWith(OPTIONS_PAGE_SEARCH_HASH_PREFIX)) {
    return;
  }

  const requestId = currentHash.slice(OPTIONS_PAGE_SEARCH_HASH_PREFIX.length) || `options-hash-${Date.now()}`;
  const nextUrl = `${location.pathname}${location.search}`;

  history.replaceState(null, document.title, nextUrl);

  await recordOptionsDebug("search.hash.received", {
    requestId
  });

  try {
    const handled = await handleExtensionTabSearchMessage({
      requestId,
      targetTabId: null
    });

    await chrome.storage.local.set({
      [OPTIONS_PAGE_SEARCH_HASH_RESPONSE_STORAGE_KEY]: {
        requestId,
        ok: handled,
        error: handled ? "" : "options-overlay-skipped"
      }
    });

    await recordOptionsDebug("search.hash.result", {
      requestId,
      ok: handled
    });
  } catch (error) {
    const messageText = error instanceof Error ? error.message : "Unknown error";

    await chrome.storage.local.set({
      [OPTIONS_PAGE_SEARCH_HASH_RESPONSE_STORAGE_KEY]: {
        requestId,
        ok: false,
        error: messageText
      }
    });

    await recordOptionsDebug("search.hash.error", {
      requestId,
      error: messageText
    });
  }
}

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
  await refreshDebugOutput();
}

function connectExtensionPagePort(strategy) {
  if (extensionPageReconnectTimerId) {
    clearTimeout(extensionPageReconnectTimerId);
    extensionPageReconnectTimerId = null;
  }

  const port = chrome.runtime.connect({ name: EXTENSION_PAGE_PORT_NAME });
  extensionPagePort = port;

  registerExtensionPagePort(port, strategy);

  port.onMessage.addListener((message) => {
    if (port !== extensionPagePort || message?.type !== "open-extension-tab-search") {
      return;
    }

    void recordOptionsDebug("search.request.received", {
      requestId: message.requestId,
      targetTabId: message.targetTabId
    });

    handleExtensionTabSearchMessage(message)
      .then((handled) => {
        postExtensionPagePortMessage(port, {
          type: "open-extension-tab-search-result",
          requestId: message.requestId,
          ok: handled
        });
        return recordOptionsDebug("search.request.result", {
          requestId: message.requestId,
          ok: handled
        });
      })
      .catch((error) => {
        postExtensionPagePortMessage(port, {
          type: "open-extension-tab-search-result",
          requestId: message.requestId,
          ok: false,
          error: error instanceof Error ? error.message : "Unknown error"
        });
        return recordOptionsDebug("search.request.error", error);
      });
  });

  port.onDisconnect.addListener(() => {
    if (port !== extensionPagePort) {
      return;
    }

    const errorMessage = chrome.runtime.lastError?.message || "";
    extensionPagePort = null;
    void recordOptionsDebug("port.disconnected", {
      error: errorMessage,
      strategy
    });

    extensionPageReconnectTimerId = setTimeout(() => {
      void recordOptionsDebug("port.reconnecting", { delayMs: 150 });
      connectExtensionPagePort("reconnect");
    }, 150);
  });
}

function postExtensionPagePortMessage(port, message) {
  try {
    port.postMessage(message);
    return true;
  } catch (error) {
    void recordOptionsDebug("port.post.error", error);
    return false;
  }
}

function registerExtensionPagePort(port, strategy) {
  postExtensionPagePortMessage(port, {
    type: "register-options-page"
  });
  void recordOptionsDebug("port.registered", {
    tabId: null,
    strategy: `${strategy}-unbound`
  });
}

async function handleExtensionTabSearchMessage(message) {
  if (document.visibilityState !== "visible") {
    await recordOptionsDebug("search.request.skipped", {
      reason: "page-not-visible",
      visibilityState: document.visibilityState
    });
    return false;
  }

  const openInlineSearch = globalThis.AITabSearchOverlay?.openTabSearch;

  if (typeof openInlineSearch !== "function") {
    throw new Error("Inline search overlay is unavailable on the settings page.");
  }

  await openInlineSearch(message.tabs);
  await recordOptionsDebug("search.overlay.opened", {
    targetTabId: Number(message?.targetTabId) || null,
    requestId: message.requestId
  });
  return true;
}

async function handleRuntimeExtensionTabSearchMessage(message) {
  await recordOptionsDebug("search.runtime.received", {
    targetTabId: Number(message?.targetTabId) || null
  });

  const handled = await handleExtensionTabSearchMessage(message);

  if (!handled) {
    return { ok: false, error: "options-overlay-skipped" };
  }

  return { ok: true };
}

async function handleStorageExtensionTabSearchRequest(request) {
  await recordOptionsDebug("search.storage.received", {
    targetTabId: Number(request?.targetTabId) || null,
    requestId: request.requestId
  });

  try {
    const handled = await handleExtensionTabSearchMessage(request);
    await chrome.storage.local.set({
      [EXTENSION_PAGE_SEARCH_RESPONSE_STORAGE_KEY]: {
        requestId: request.requestId,
        ok: handled,
        error: handled ? "" : "options-overlay-skipped",
        currentTabId: null
      }
    });
    await recordOptionsDebug("search.storage.result", {
      requestId: request.requestId,
      ok: handled
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    await chrome.storage.local.set({
      [EXTENSION_PAGE_SEARCH_RESPONSE_STORAGE_KEY]: {
        requestId: request.requestId,
        ok: false,
        error: message,
        currentTabId: null
      }
    });
    await recordOptionsDebug("search.storage.error", {
      requestId: request.requestId,
      error: message
    });
  }
}

async function recordOptionsDebug(event, details) {
  return recordTabSearchDebug("options", event, details);
}

async function refreshDebugOutput() {
  if (!debugLogOutput) {
    return;
  }

  const events = await readTabSearchDebugEvents();
  debugLogOutput.textContent = events.length > 0
    ? events.map((entry) => formatTabSearchDebugEvent(entry)).join("\n")
    : "暂无日志。";
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
})();
