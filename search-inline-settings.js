(function attachInlineSearchSettings(root, factory) {
  const api = factory(root);

  root.AITabInlineSettings = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createInlineSearchSettings(root) {
  const i18n = root.AITabI18n;
  const INLINE_SETTINGS_STORAGE_SUFFIX_KEYS = Object.freeze([
    "aiEndpoint",
    "aiApiKey",
    "aiModel",
    "aiPreference",
    "experimentalTitleRewriteEnabled",
    i18n?.UI_LANGUAGE_STORAGE_KEY || "uiLanguage"
  ]);

  function getInlineSettingsStorageKeys(providerConfig) {
    const config = providerConfig || root.AIProviderConfig;
    return [config.AI_PROVIDER_STORAGE_KEY, ...INLINE_SETTINGS_STORAGE_SUFFIX_KEYS];
  }

  function buildInlineSettingsPayload(settings, providerConfig) {
    const config = providerConfig || root.AIProviderConfig;
    const source = settings || {};
    const endpoint = config.normalizeAIEndpoint(source.endpoint);

    return {
      [config.AI_PROVIDER_STORAGE_KEY]: source.providerId || config.detectAIProviderPreset(endpoint),
      aiEndpoint: endpoint,
      aiApiKey: String(source.apiKey || "").trim(),
      aiModel: String(source.model || "").trim(),
      aiPreference: String(source.preference || "").trim(),
      experimentalTitleRewriteEnabled: Boolean(source.experimentalTitleRewriteEnabled),
      [i18n?.UI_LANGUAGE_STORAGE_KEY || "uiLanguage"]: i18n?.resolveUILanguage
        ? i18n.resolveUILanguage(source.uiLanguage)
        : String(source.uiLanguage || "cn")
    };
  }

  async function loadInlineSettings(storageArea, providerConfig) {
    const storage = storageArea || root.chrome?.storage?.local;
    const config = providerConfig || root.AIProviderConfig;
    const stored = await storage.get(getInlineSettingsStorageKeys(config));
    return config.resolveAISettingsDraft(stored);
  }

  async function saveInlineSettings(settings, storageArea, providerConfig) {
    const storage = storageArea || root.chrome?.storage?.local;
    await storage.set(buildInlineSettingsPayload(settings, providerConfig || root.AIProviderConfig));
  }

  return Object.freeze({
    buildInlineSettingsPayload,
    getInlineSettingsStorageKeys,
    loadInlineSettings,
    saveInlineSettings
  });
});
