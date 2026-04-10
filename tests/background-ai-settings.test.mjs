import test from "node:test";
import assert from "node:assert/strict";
import { resolveBackgroundAISettings } from "../background-ai-settings.mjs";

test("resolveBackgroundAISettings 会复用共享 endpoint 归一化规则", () => {
  const settings = resolveBackgroundAISettings({
    aiEndpoint: "https://example.com/custom/v1",
    aiApiKey: "sk-test",
    aiModel: "",
    aiPreference: "group by task",
    experimentalTitleRewriteEnabled: true
  });

  assert.equal(settings.endpoint, "https://example.com/custom/v1/chat/completions");
  assert.equal(settings.apiKey, "sk-test");
  assert.equal(settings.model, "gpt-4.1-mini");
  assert.equal(settings.preference, "group by task");
  assert.equal(settings.experimentalTitleRewriteEnabled, true);
});
