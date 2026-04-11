(function attachAIProviderConfig(root, factory) {
  const api = factory();

  root.AIProviderConfig = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createAIProviderConfig() {
  const i18n = typeof globalThis !== "undefined" ? globalThis.AITabI18n : null;
  const AI_PROVIDER_STORAGE_KEY = "aiProviderPresetId";
  const CUSTOM_AI_PROVIDER_ID = "custom";
  const CUSTOM_AI_MODEL_OPTION_VALUE = "__custom_model__";
  const DEFAULT_AI_PROVIDER_ID = "openai";
  const DEFAULT_AI_ENDPOINT = "https://api.openai.com/v1/chat/completions";
  const DEFAULT_AI_MODEL = "gpt-4.1-mini";
  const DEFAULT_CUSTOM_API_KEY_PLACEHOLDER = "填写兼容 OpenAI 的 API Key";

  const AI_PROVIDER_PRESETS = Object.freeze([
    Object.freeze({
      id: "openai",
      label: "OpenAI",
      localizedLabel: false,
      endpoint: "https://api.openai.com/v1/chat/completions",
      defaultModel: "gpt-4.1-mini",
      apiKeyPlaceholder: "填写 OpenAI API Key",
      models: [
        { value: "gpt-4.1-mini", label: "gpt-4.1-mini" },
        { value: "gpt-4.1", label: "gpt-4.1" },
        { value: "gpt-4.1-nano", label: "gpt-4.1-nano" },
        { value: "gpt-4o-mini", label: "gpt-4o-mini" },
        { value: "gpt-4o", label: "gpt-4o" }
      ]
    }),
    Object.freeze({
      id: "openrouter",
      label: "OpenRouter",
      localizedLabel: false,
      endpoint: "https://openrouter.ai/api/v1/chat/completions",
      defaultModel: "openai/gpt-4.1-mini",
      apiKeyPlaceholder: "填写 OpenRouter API Key",
      models: [
        { value: "openai/gpt-4.1-mini", label: "openai/gpt-4.1-mini" },
        { value: "openai/gpt-4.1", label: "openai/gpt-4.1" },
        { value: "anthropic/claude-3.7-sonnet", label: "anthropic/claude-3.7-sonnet" },
        { value: "google/gemini-2.5-flash", label: "google/gemini-2.5-flash" },
        { value: "deepseek/deepseek-chat-v3-0324", label: "deepseek/deepseek-chat-v3-0324" }
      ]
    }),
    Object.freeze({
      id: "groq",
      label: "Groq",
      localizedLabel: false,
      endpoint: "https://api.groq.com/openai/v1/chat/completions",
      defaultModel: "llama-3.3-70b-versatile",
      apiKeyPlaceholder: "填写 Groq API Key",
      models: [
        { value: "llama-3.3-70b-versatile", label: "llama-3.3-70b-versatile" },
        { value: "llama-3.1-8b-instant", label: "llama-3.1-8b-instant" },
        { value: "mixtral-8x7b-32768", label: "mixtral-8x7b-32768" }
      ]
    }),
    Object.freeze({
      id: "deepseek",
      label: "DeepSeek",
      localizedLabel: false,
      endpoint: "https://api.deepseek.com/v1/chat/completions",
      defaultModel: "deepseek-chat",
      apiKeyPlaceholder: "填写 DeepSeek API Key",
      models: [
        { value: "deepseek-chat", label: "deepseek-chat" },
        { value: "deepseek-reasoner", label: "deepseek-reasoner" }
      ]
    }),
    Object.freeze({
      id: "siliconflow",
      label: "硅基流动",
      localizedLabel: true,
      endpoint: "https://api.siliconflow.cn/v1/chat/completions",
      defaultModel: "Qwen/Qwen2.5-7B-Instruct",
      apiKeyPlaceholder: "填写硅基流动 API Key",
      models: [
        { value: "Qwen/Qwen2.5-7B-Instruct", label: "Qwen/Qwen2.5-7B-Instruct" },
        { value: "deepseek-ai/DeepSeek-V3", label: "deepseek-ai/DeepSeek-V3" },
        { value: "deepseek-ai/DeepSeek-R1", label: "deepseek-ai/DeepSeek-R1" },
        { value: "Qwen/QwQ-32B", label: "Qwen/QwQ-32B" }
      ]
    }),
    Object.freeze({
      id: "dashscope",
      label: "阿里云百炼",
      localizedLabel: true,
      endpoint: "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
      defaultModel: "qwen-plus",
      apiKeyPlaceholder: "填写阿里云百炼 API Key",
      models: [
        { value: "qwen-plus", label: "qwen-plus" },
        { value: "qwen-turbo", label: "qwen-turbo" },
        { value: "qwen-max", label: "qwen-max" }
      ]
    }),
    Object.freeze({
      id: CUSTOM_AI_PROVIDER_ID,
      label: "自定义",
      localizedLabel: true,
      endpoint: DEFAULT_AI_ENDPOINT,
      defaultModel: DEFAULT_AI_MODEL,
      apiKeyPlaceholder: DEFAULT_CUSTOM_API_KEY_PLACEHOLDER,
      models: []
    })
  ]);

  const presetMap = new Map(AI_PROVIDER_PRESETS.map((preset) => [preset.id, preset]));

  function resolveLocale(locale) {
    return i18n?.resolveUILanguage ? i18n.resolveUILanguage(locale) : "cn";
  }

  function localizePreset(preset, locale) {
    const language = resolveLocale(locale);

    if (!i18n) {
      return preset;
    }

    return {
      ...preset,
      label: preset.localizedLabel ? i18n.getProviderLabel(preset.id, language, preset.label) : preset.label,
      apiKeyPlaceholder: i18n.getProviderApiKeyPlaceholder(preset.id, language, preset.label)
    };
  }

  function getAIProviderPreset(providerId, locale) {
    const preset = presetMap.get(providerId) || presetMap.get(CUSTOM_AI_PROVIDER_ID);
    return localizePreset(preset, locale);
  }

  function normalizeAIEndpoint(endpoint) {
    const value = String(endpoint || "").trim();

    if (!value) {
      return DEFAULT_AI_ENDPOINT;
    }

    try {
      const url = new URL(value);
      const pathname = trimTrailingSlash(url.pathname);

      if (!pathname) {
        url.pathname = "/v1/chat/completions";
        return url.toString();
      }

      if (pathname.endsWith("/chat/completions")) {
        url.pathname = pathname;
        return url.toString();
      }

      const segments = pathname.split("/").filter(Boolean);
      const lastSegment = segments[segments.length - 1] || "";

      if (/^v\d+$/i.test(lastSegment)) {
        url.pathname = `/${segments.join("/")}/chat/completions`;
      } else {
        url.pathname = pathname;
      }

      return url.toString();
    } catch (_error) {
      return value;
    }
  }

  function detectAIProviderPreset(endpoint) {
    const normalized = normalizeAIEndpoint(endpoint);

    try {
      const target = stripCompletionPath(new URL(normalized));

      for (const preset of AI_PROVIDER_PRESETS) {
        if (preset.id === CUSTOM_AI_PROVIDER_ID) {
          continue;
        }

        const presetBase = stripCompletionPath(new URL(preset.endpoint));

        if (target === presetBase) {
          return preset.id;
        }
      }
    } catch (_error) {
      return CUSTOM_AI_PROVIDER_ID;
    }

    return CUSTOM_AI_PROVIDER_ID;
  }

  function applyAIProviderPreset(providerId, currentDraft, locale) {
    const preset = getAIProviderPreset(providerId, locale);
    const draft = currentDraft || {};

    if (preset.id === CUSTOM_AI_PROVIDER_ID) {
      return {
        ...draft,
        providerId: CUSTOM_AI_PROVIDER_ID,
        endpoint: normalizeAIEndpoint(draft.endpoint || DEFAULT_AI_ENDPOINT),
        model: String(draft.model || "").trim() || DEFAULT_AI_MODEL,
        apiKeyPlaceholder: preset.apiKeyPlaceholder
      };
    }

    return {
      ...draft,
      providerId: preset.id,
      endpoint: preset.endpoint,
      model: preset.defaultModel,
      apiKeyPlaceholder: preset.apiKeyPlaceholder
    };
  }

  function resolveAISettingsDraft(stored, locale) {
    const source = stored || {};
    const endpoint = normalizeAIEndpoint(source.aiEndpoint || DEFAULT_AI_ENDPOINT);
    const savedProviderId = String(source[AI_PROVIDER_STORAGE_KEY] || "").trim();
    const providerId = presetMap.has(savedProviderId) ? savedProviderId : detectAIProviderPreset(endpoint);
    const preset = getAIProviderPreset(providerId, locale);

    return {
      providerId,
      endpoint,
      apiKey: source.aiApiKey || "",
      apiKeyPlaceholder: preset.apiKeyPlaceholder,
      model: String(source.aiModel || "").trim() || preset.defaultModel || DEFAULT_AI_MODEL,
      preference: source.aiPreference || "",
      experimentalTitleRewriteEnabled: Boolean(source.experimentalTitleRewriteEnabled),
      uiLanguage: i18n?.resolveUILanguage ? i18n.resolveUILanguage(source.uiLanguage) : "cn"
    };
  }

  function getAIModelOptions(providerId) {
    const preset = getAIProviderPreset(providerId);
    return Array.isArray(preset.models) ? preset.models.slice() : [];
  }

  function resolveAIModelSelection(providerId, model) {
    const preset = getAIProviderPreset(providerId);
    const trimmedModel = String(model || "").trim();
    const options = getAIModelOptions(providerId);
    const fallbackModel = preset.defaultModel || DEFAULT_AI_MODEL;
    const matched = options.find((item) => item.value === trimmedModel);

    if (providerId === CUSTOM_AI_PROVIDER_ID) {
      return {
        options,
        selectedValue: CUSTOM_AI_MODEL_OPTION_VALUE,
        customValue: trimmedModel || fallbackModel
      };
    }

    if (matched) {
      return {
        options,
        selectedValue: matched.value,
        customValue: ""
      };
    }

    if (!trimmedModel) {
      return {
        options,
        selectedValue: fallbackModel,
        customValue: ""
      };
    }

    return {
      options,
      selectedValue: CUSTOM_AI_MODEL_OPTION_VALUE,
      customValue: trimmedModel
    };
  }

  function populateAIProviderSelect(select, locale) {
    if (!select) {
      return;
    }

    select.textContent = "";

    AI_PROVIDER_PRESETS.forEach((preset) => {
      const option = select.ownerDocument.createElement("option");
      option.value = preset.id;
      option.textContent = getAIProviderPreset(preset.id, locale).label;
      select.appendChild(option);
    });
  }

  function populateAIModelSelect(select, providerId, currentModel, locale) {
    if (!select) {
      return;
    }

    const selection = resolveAIModelSelection(providerId, currentModel);
    select.textContent = "";

    selection.options.forEach((item) => {
      const option = select.ownerDocument.createElement("option");
      option.value = item.value;
      option.textContent = item.label;
      select.appendChild(option);
    });

    const customOption = select.ownerDocument.createElement("option");
    customOption.value = CUSTOM_AI_MODEL_OPTION_VALUE;
    customOption.textContent = i18n?.t ? i18n.t(locale, "customModelPlaceholder") : "自定义模型";
    select.appendChild(customOption);
    select.value = selection.selectedValue;
  }

  function updateAIKeyPlaceholder(input, providerId, locale) {
    if (!input) {
      return;
    }

    input.placeholder = getAIProviderPreset(providerId, locale).apiKeyPlaceholder;
  }

  function stripCompletionPath(url) {
    return `${url.origin}${trimTrailingSlash(url.pathname).replace(/\/chat\/completions$/i, "")}`;
  }

  function trimTrailingSlash(pathname) {
    const normalized = String(pathname || "").trim();

    if (!normalized || normalized === "/") {
      return "";
    }

    return normalized.replace(/\/+$/g, "");
  }

  return Object.freeze({
    AI_PROVIDER_STORAGE_KEY,
    AI_PROVIDER_PRESETS,
    CUSTOM_AI_MODEL_OPTION_VALUE,
    CUSTOM_AI_PROVIDER_ID,
    DEFAULT_AI_ENDPOINT,
    DEFAULT_AI_MODEL,
    DEFAULT_CUSTOM_API_KEY_PLACEHOLDER,
    applyAIProviderPreset,
    detectAIProviderPreset,
    getAIModelOptions,
    getAIProviderPreset,
    normalizeAIEndpoint,
    populateAIModelSelect,
    resolveAIModelSelection,
    populateAIProviderSelect,
    resolveAISettingsDraft,
    updateAIKeyPlaceholder
  });
});
