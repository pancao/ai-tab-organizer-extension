import test from "node:test";
import assert from "node:assert/strict";
import searchCore from "../search-core.js";

const {
  SEARCH_ACTIONS,
  buildEntries,
  buildNaturalEntries,
  cycleAction,
  defaultActionForEntry,
  normalizeIndex,
  supportsActions
} = searchCore;

test("buildEntries 遇到设置指令时只返回设置命令", () => {
  const entries = buildEntries(
    [{ id: 1, title: "Docs", url: "https://docs.example.com", favIconUrl: "" }],
    "settings"
  );

  assert.deepEqual(entries, [
    {
      id: "command-settings",
      kind: "command",
      command: "settings",
      title: "设置",
      subtitle: "设置主题色、服务商、AI 接口和整理偏好"
    }
  ]);
});

test("buildEntries 会在无匹配时插入自然语言搜索和兜底打开项", () => {
  const entries = buildEntries([], "找出三天没打开的标签");

  assert.equal(entries[0].kind, "url");
  assert.equal(entries[0].title, "搜索");
  assert.equal(entries[0].isSearch, true);
  assert.equal(entries[1].command, "natural-search");
});

test("cycleAction 会按共享动作列表循环切换", () => {
  assert.equal(cycleAction(null, "forward"), SEARCH_ACTIONS[0]);
  assert.equal(cycleAction("open", "backward"), SEARCH_ACTIONS[SEARCH_ACTIONS.length - 1]);
  assert.equal(cycleAction("bookmark_close", "forward"), SEARCH_ACTIONS[0]);
});

test("共享条目辅助函数会给标签页返回可执行动作", () => {
  const previewEntries = buildNaturalEntries({
    tabs: [{ id: 7, title: "Mail", url: "https://mail.example.com", favIconUrl: "" }]
  });

  assert.equal(previewEntries[0].kind, "tab");
  assert.equal(supportsActions(previewEntries[0]), true);
  assert.equal(defaultActionForEntry(previewEntries[0]), "open");
  assert.equal(normalizeIndex(10, previewEntries), 0);
  assert.equal(normalizeIndex(-1, previewEntries), -1);
});
