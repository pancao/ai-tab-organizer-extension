import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { SEARCH_PANEL_INJECTION_FILES } from "../search-panel-injection.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");

function readRepoFile(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function assertUsesSharedSettingsPage(source, filePath) {
  assert.match(
    source,
    /chrome\.runtime\.sendMessage\(\{\s*type:\s*"open-settings-page"\s*\}\)/,
    `${filePath} 应该通过统一消息打开公用设置页`
  );
}

function assertNoInlineSettingsView(source, filePath) {
  assert.doesNotMatch(source, /enterSettingsView/, `${filePath} 不应该再保留内嵌设置入口函数`);
  assert.doesNotMatch(source, /renderSettingsView/, `${filePath} 不应该再保留内嵌设置渲染逻辑`);
  assert.doesNotMatch(source, /searchMode\s*===\s*"settings"/, `${filePath} 不应该再切换到 settings 视图`);
  assert.doesNotMatch(source, /searchMode\s*=\s*"settings"/, `${filePath} 不应该再写入 settings 模式`);
  assert.doesNotMatch(source, /AITabInlineSettings/, `${filePath} 不应该再依赖内嵌设置脚本`);
  assert.doesNotMatch(source, /AIProviderConfig/, `${filePath} 不应该再依赖 AI 设置表单脚本`);
}

test("搜索页和页内面板的设置入口都会打开同一个设置页", () => {
  const searchSource = readRepoFile("search.js");
  const contentSource = readRepoFile("content.js");

  assertUsesSharedSettingsPage(searchSource, "search.js");
  assertUsesSharedSettingsPage(contentSource, "content.js");
});

test("搜索相关脚本不再保留内嵌设置视图", () => {
  assertNoInlineSettingsView(readRepoFile("search.js"), "search.js");
  assertNoInlineSettingsView(readRepoFile("content.js"), "content.js");
});

test("独立搜索页和按需注入清单不再加载内嵌设置依赖", () => {
  const searchHtml = readRepoFile("search.html");

  assert.deepEqual(SEARCH_PANEL_INJECTION_FILES, ["i18n.js", "search-core.js", "content.js"]);
  assert.doesNotMatch(searchHtml, /ai-provider-config\.js/, "search.html 不应该再加载 ai-provider-config.js");
  assert.doesNotMatch(searchHtml, /search-inline-settings\.js/, "search.html 不应该再加载 search-inline-settings.js");
});
