import "./ai-provider-config.js";
import "./i18n.js";

const aiProviderConfig = globalThis.AIProviderConfig;
const i18n = globalThis.AITabI18n;

if (!aiProviderConfig) {
  throw new Error("AIProviderConfig is unavailable.");
}

const { DEFAULT_AI_ENDPOINT, DEFAULT_AI_MODEL, normalizeAIEndpoint } = aiProviderConfig;

export function resolveBackgroundAISettings(stored) {
  const source = stored || {};

  return {
    endpoint: normalizeAIEndpoint(source.aiEndpoint || DEFAULT_AI_ENDPOINT),
    apiKey: source.aiApiKey || "",
    model: source.aiModel || DEFAULT_AI_MODEL,
    preference: source.aiPreference || "",
    experimentalTitleRewriteEnabled: Boolean(source.experimentalTitleRewriteEnabled),
    uiLanguage: i18n?.resolveUILanguage ? i18n.resolveUILanguage(source[i18n.UI_LANGUAGE_STORAGE_KEY]) : "cn"
  };
}
