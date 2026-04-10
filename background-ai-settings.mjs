import "./ai-provider-config.js";

const aiProviderConfig = globalThis.AIProviderConfig;

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
    experimentalTitleRewriteEnabled: Boolean(source.experimentalTitleRewriteEnabled)
  };
}
