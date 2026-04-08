import test from "node:test";
import assert from "node:assert/strict";
import config from "../ai-provider-config.js";

const {
  AI_PROVIDER_STORAGE_KEY,
  AI_PROVIDER_PRESETS,
  CUSTOM_AI_MODEL_OPTION_VALUE,
  CUSTOM_AI_PROVIDER_ID,
  DEFAULT_AI_ENDPOINT,
  DEFAULT_AI_MODEL,
  applyAIProviderPreset,
  detectAIProviderPreset,
  getAIModelOptions,
  normalizeAIEndpoint,
  resolveAIModelSelection,
  resolveAISettingsDraft
} = config;

test("exports the expected preset ids", () => {
  assert.deepEqual(
    AI_PROVIDER_PRESETS.map((item) => item.id),
    ["openai", "openrouter", "groq", "deepseek", "siliconflow", "dashscope", "custom"]
  );
});

test("normalizes root and versioned compatible endpoints", () => {
  assert.equal(normalizeAIEndpoint("https://api.openai.com"), "https://api.openai.com/v1/chat/completions");
  assert.equal(
    normalizeAIEndpoint("https://openrouter.ai/api/v1"),
    "https://openrouter.ai/api/v1/chat/completions"
  );
  assert.equal(
    normalizeAIEndpoint("https://dashscope.aliyuncs.com/compatible-mode/v1/"),
    "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions"
  );
  assert.equal(
    normalizeAIEndpoint("https://api.groq.com/openai/v1/chat/completions"),
    "https://api.groq.com/openai/v1/chat/completions"
  );
});

test("detects provider presets from normalized endpoints", () => {
  assert.equal(detectAIProviderPreset("https://api.openai.com/v1/chat/completions"), "openai");
  assert.equal(detectAIProviderPreset("https://openrouter.ai/api/v1"), "openrouter");
  assert.equal(detectAIProviderPreset("https://api.groq.com/openai/v1/chat/completions"), "groq");
  assert.equal(detectAIProviderPreset("https://api.deepseek.com/v1"), "deepseek");
  assert.equal(detectAIProviderPreset("https://api.siliconflow.cn/v1/chat/completions"), "siliconflow");
  assert.equal(detectAIProviderPreset("https://dashscope.aliyuncs.com/compatible-mode/v1"), "dashscope");
  assert.equal(detectAIProviderPreset("https://example.com/custom/v1"), "custom");
});

test("applies provider presets with recommended endpoint, model, and API key placeholder", () => {
  const preset = applyAIProviderPreset("groq", { apiKey: "secret", preference: "work first" });
  assert.equal(preset.providerId, "groq");
  assert.equal(preset.endpoint, "https://api.groq.com/openai/v1/chat/completions");
  assert.equal(preset.model, "llama-3.3-70b-versatile");
  assert.equal(preset.apiKey, "secret");
  assert.equal(preset.preference, "work first");
  assert.equal(preset.apiKeyPlaceholder, "填写 Groq API Key");
});

test("returns common model options for a provider", () => {
  const values = getAIModelOptions("openai").map((item) => item.value);

  assert.deepEqual(values, ["gpt-4.1-mini", "gpt-4.1", "gpt-4.1-nano", "gpt-4o-mini", "gpt-4o"]);
});

test("keeps known models selected in the model preset dropdown", () => {
  const selection = resolveAIModelSelection("deepseek", "deepseek-reasoner");

  assert.equal(selection.selectedValue, "deepseek-reasoner");
  assert.equal(selection.customValue, "");
});

test("switches to custom model mode when model is not in the preset list", () => {
  const selection = resolveAIModelSelection("openrouter", "my-special-model");

  assert.equal(selection.selectedValue, CUSTOM_AI_MODEL_OPTION_VALUE);
  assert.equal(selection.customValue, "my-special-model");
});

test("custom provider uses custom model mode directly", () => {
  const selection = resolveAIModelSelection(CUSTOM_AI_PROVIDER_ID, "anything-model");

  assert.equal(selection.selectedValue, CUSTOM_AI_MODEL_OPTION_VALUE);
  assert.equal(selection.customValue, "anything-model");
});

test("resolves stored settings using saved provider id when available", () => {
  const draft = resolveAISettingsDraft({
    [AI_PROVIDER_STORAGE_KEY]: "openrouter",
    aiEndpoint: "https://openrouter.ai/api/v1",
    aiApiKey: "sk-or-v1-test",
    aiModel: "",
    aiPreference: "group by task",
    experimentalTitleRewriteEnabled: true
  });

  assert.equal(draft.providerId, "openrouter");
  assert.equal(draft.endpoint, "https://openrouter.ai/api/v1/chat/completions");
  assert.equal(draft.apiKey, "sk-or-v1-test");
  assert.equal(draft.apiKeyPlaceholder, "填写 OpenRouter API Key");
  assert.equal(draft.model, "openai/gpt-4.1-mini");
  assert.equal(draft.preference, "group by task");
  assert.equal(draft.experimentalTitleRewriteEnabled, true);
});

test("falls back to defaults for blank settings", () => {
  const draft = resolveAISettingsDraft({});

  assert.equal(draft.providerId, "openai");
  assert.equal(draft.endpoint, DEFAULT_AI_ENDPOINT);
  assert.equal(draft.model, DEFAULT_AI_MODEL);
});

test("keeps custom provider selection when endpoint does not match a preset", () => {
  const draft = resolveAISettingsDraft({
    [AI_PROVIDER_STORAGE_KEY]: CUSTOM_AI_PROVIDER_ID,
    aiEndpoint: "https://example.com/custom/v1",
    aiModel: "my-model"
  });

  assert.equal(draft.providerId, CUSTOM_AI_PROVIDER_ID);
  assert.equal(draft.endpoint, "https://example.com/custom/v1/chat/completions");
  assert.equal(draft.model, "my-model");
  assert.equal(draft.apiKeyPlaceholder, "填写兼容 OpenAI 的 API Key");
});
