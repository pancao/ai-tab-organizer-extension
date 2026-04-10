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
      subtitle: "设置主题色、服务商、AI 接口、语言和整理偏好"
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

test("buildEntries 在弱匹配时也追加搜索候选项到末尾", () => {
  // score=1：query 只匹配了 url 没匹配 title，得分不足 3
  const tabs = [{ id: 1, title: "Google Docs", url: "https://docs.google.com/foo", favIconUrl: "" }];
  const entries = buildEntries(tabs, "foo");

  // 第一项仍是 tab
  assert.equal(entries[0].kind, "tab");
  // 末尾追加了搜索候选项
  const last = entries[entries.length - 1];
  assert.equal(last.kind, "url");
});

test("buildEntries 在强匹配时不追加搜索候选项", () => {
  const tabs = [{ id: 1, title: "foo bar", url: "https://example.com", favIconUrl: "" }];
  const entries = buildEntries(tabs, "foo");

  // title 匹配得 3 分，不插入 fallback
  assert.ok(entries.every((e) => e.kind !== "url"));
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
