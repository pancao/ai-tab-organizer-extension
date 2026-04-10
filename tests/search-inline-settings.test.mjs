import test from "node:test";
import assert from "node:assert/strict";
import providerConfig from "../ai-provider-config.js";
import inlineSettings from "../search-inline-settings.js";

const { buildInlineSettingsPayload, loadInlineSettings, saveInlineSettings } = inlineSettings;

test("buildInlineSettingsPayload 会统一保存时的 endpoint 和 provider", () => {
  const payload = buildInlineSettingsPayload(
    {
      providerId: "",
      endpoint: "https://example.com/custom/v1",
      apiKey: " sk-test ",
      model: " custom-model ",
      preference: " group by task ",
      experimentalTitleRewriteEnabled: 1
    },
    providerConfig
  );

  assert.equal(payload.aiProviderPresetId, "custom");
  assert.equal(payload.aiEndpoint, "https://example.com/custom/v1/chat/completions");
  assert.equal(payload.aiApiKey, "sk-test");
  assert.equal(payload.aiModel, "custom-model");
  assert.equal(payload.aiPreference, "group by task");
  assert.equal(payload.experimentalTitleRewriteEnabled, true);
});

test("loadInlineSettings 和 saveInlineSettings 会复用同一套设置规则", async () => {
  let savedPayload = null;

  const storage = {
    async get() {
      return {
        aiProviderPresetId: "openrouter",
        aiEndpoint: "https://openrouter.ai/api/v1",
        aiApiKey: "sk-or-v1",
        aiModel: "",
        aiPreference: "group by task",
        experimentalTitleRewriteEnabled: false
      };
    },
    async set(payload) {
      savedPayload = payload;
    }
  };

  const settings = await loadInlineSettings(storage, providerConfig);

  assert.equal(settings.providerId, "openrouter");
  assert.equal(settings.endpoint, "https://openrouter.ai/api/v1/chat/completions");

  await saveInlineSettings(
    {
      providerId: "",
      endpoint: "https://example.com/compatible/v1",
      apiKey: "key",
      model: "demo-model",
      preference: "",
      experimentalTitleRewriteEnabled: true
    },
    storage,
    providerConfig
  );

  assert.deepEqual(savedPayload, {
    aiProviderPresetId: "custom",
    aiEndpoint: "https://example.com/compatible/v1/chat/completions",
    aiApiKey: "key",
    aiModel: "demo-model",
    aiPreference: "",
    experimentalTitleRewriteEnabled: true
  });
});
