import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const repoRoot = path.resolve(import.meta.dirname, "..");

function createFakeElement() {
  return {
    value: "",
    checked: false,
    disabled: false,
    textContent: "",
    dataset: {},
    style: {},
    ownerDocument: null,
    classList: {
      toggle() {},
      add() {},
      remove() {}
    },
    appendChild() {},
    addEventListener() {},
    removeEventListener() {},
    setAttribute() {}
  };
}

function createExecutionContext() {
  const elementCache = new Map();
  const swatches = [createFakeElement(), createFakeElement()];

  const document = {
    documentElement: { dataset: {} },
    createElement() {
      const element = createFakeElement();
      element.ownerDocument = document;
      return element;
    },
    getElementById(id) {
      if (!elementCache.has(id)) {
        const element = createFakeElement();
        element.ownerDocument = document;
        elementCache.set(id, element);
      }

      return elementCache.get(id);
    },
    querySelectorAll(selector) {
      if (selector === ".theme-swatch") {
        return swatches;
      }

      return [];
    }
  };

  const context = {
    console,
    setTimeout,
    clearTimeout,
    document,
    window: null,
    globalThis: null,
    chrome: {
      runtime: {
        onMessage: {
          addListener() {}
        },
        sendMessage: async () => ({ ok: true })
      },
      storage: {
        local: {
          get: async () => ({}),
          set: async () => {}
        }
      }
    },
    AITabI18n: null,
    AIProviderConfig: null,
    AITabInlineSettings: null,
    AITabSearchCore: null
  };

  context.window = context;
  context.globalThis = context;
  context.AITabI18n = {
    DEFAULT_UI_LANGUAGE: "cn",
    UI_LANGUAGE_STORAGE_KEY: "uiLanguage",
    getLanguageOptions() {
      return [{ value: "cn", label: "简体中文" }, { value: "en", label: "English" }];
    },
    getLocaleTag() {
      return "zh-CN";
    },
    getStoredLanguage: async () => "cn",
    getThemeOptions() {
      return [];
    },
    resolveUILanguage(value) {
      return value || "cn";
    },
    t(_locale, key) {
      return key;
    }
  };
  context.globalThis.AITabI18n = context.AITabI18n;
  context.AIProviderConfig = {
    AI_PROVIDER_STORAGE_KEY: "aiProvider",
    CUSTOM_AI_MODEL_OPTION_VALUE: "__custom__",
    applyAIProviderPreset(providerId, draft) {
      return {
        ...draft,
        endpoint: draft.endpoint || "https://api.openai.com/v1/chat/completions",
        model: draft.model || "gpt-4.1-mini",
        providerId
      };
    },
    detectAIProviderPreset() {
      return "openai";
    },
    normalizeAIEndpoint(value) {
      return value || "https://api.openai.com/v1/chat/completions";
    },
    populateAIModelSelect(element, providerId, modelValue) {
      element.value = modelValue || "gpt-4.1-mini";
      element.dataset.providerId = providerId || "openai";
    },
    populateAIProviderSelect(element) {
      element.value = "openai";
    },
    resolveAIModelSelection(providerId, modelValue) {
      return {
        selectedValue: modelValue || "gpt-4.1-mini",
        customValue: "",
        options: [{ value: "gpt-4.1-mini", label: "gpt-4.1-mini" }],
        providerId
      };
    },
    resolveAISettingsDraft(stored) {
      return {
        providerId: stored.aiProvider || "openai",
        endpoint: stored.aiEndpoint || "https://api.openai.com/v1/chat/completions",
        apiKey: stored.aiApiKey || "",
        model: stored.aiModel || "gpt-4.1-mini",
        preference: stored.aiPreference || "",
        experimentalTitleRewriteEnabled: Boolean(stored.experimentalTitleRewriteEnabled),
        uiLanguage: stored.uiLanguage || "cn"
      };
    },
    updateAIKeyPlaceholder() {}
  };
  context.globalThis.AIProviderConfig = context.AIProviderConfig;
  context.AITabInlineSettings = {
    loadInlineSettings: async () => context.AIProviderConfig.resolveAISettingsDraft({}),
    saveInlineSettings: async () => {}
  };
  context.globalThis.AITabInlineSettings = context.AITabInlineSettings;
  context.AITabSearchCore = {
    SEARCH_ACTIONS: ["open", "close", "bookmark_close"],
    buildEntries: () => [],
    buildNaturalEntries: () => [],
    cycleAction: () => "open",
    defaultActionForEntry: () => "open",
    normalizeIndex: () => 0,
    supportsActions: () => true
  };
  context.globalThis.AITabSearchCore = context.AITabSearchCore;

  return vm.createContext(context);
}

test("options page script can run after content script in the same page scope", () => {
  const contentScript = fs.readFileSync(path.join(repoRoot, "content.js"), "utf8");
  const optionsScript = fs.readFileSync(path.join(repoRoot, "options.js"), "utf8");
  const context = createExecutionContext();

  assert.doesNotThrow(() => {
    vm.runInContext(contentScript, context, { filename: "content.js" });
    vm.runInContext(optionsScript, context, { filename: "options.js" });
  });
});
