import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { SEARCH_PANEL_INJECTION_FILES } from "../search-panel-injection.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");

test("manifest 不再把搜索面板脚本常驻注入到所有页面", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(repoRoot, "manifest.json"), "utf8"));

  assert.equal("content_scripts" in manifest, false);
});

test("按需注入文件清单包含打开页内搜索面板所需脚本", () => {
  assert.deepEqual(SEARCH_PANEL_INJECTION_FILES, ["search-core.js", "content.js"]);
});
