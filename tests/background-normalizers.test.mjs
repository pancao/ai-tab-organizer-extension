import test from "node:test";
import assert from "node:assert/strict";
import {
  cleanupRewrittenTitle,
  normalizeBatchSelection,
  normalizeOrganizationPlan,
  normalizeTitleRewritePlan
} from "../background-normalizers.mjs";

test("normalizeOrganizationPlan 会过滤无效分组、去重并补齐遗漏标签页", () => {
  const tabs = [
    { id: 101, url: "https://a.test" },
    { id: 102, url: "https://b.test" },
    { id: 103, url: "https://c.test" },
    { id: 104, url: "https://d.test" }
  ];

  const plan = normalizeOrganizationPlan(
    {
      groups: [
        { name: "Work", color: "blue", collapsed: false, tabIds: [101, 102, 999] },
        { name: "Solo", color: "red", collapsed: false, tabIds: [103] },
        { name: "Dupes", color: "green", collapsed: false, tabIds: [101, 104] }
      ],
      ungroupedTabIds: [102]
    },
    tabs
  );

  assert.deepEqual(plan.groups, [
    { name: "Work", color: "blue", collapsed: false, tabIds: [101, 102] }
  ]);
  assert.deepEqual(plan.ungroupedTabIds, [103, 104]);
});

test("normalizeBatchSelection 会保留有效标签页并补默认标签名", () => {
  const tabs = [
    { id: 1, title: "Docs", url: "https://docs.example.com/page" },
    { id: 2, title: "Mail", url: "https://mail.example.com/inbox" }
  ];

  const result = normalizeBatchSelection(
    {
      selectedTabIds: [2, 2, 999],
      rationale: "These tabs match the request.",
      suggestedLabel: ""
    },
    tabs
  );

  assert.deepEqual(
    result.tabs.map((tab) => tab.id),
    [2]
  );
  assert.equal(result.rationale, "These tabs match the request.");
  assert.equal(result.suggestedLabel, "mail.example.com");
});

test("normalizeTitleRewritePlan 会清理标题、去掉重复项并忽略无效条目", () => {
  const tabs = [
    { id: 1, title: "Inbox - Gmail", url: "https://mail.google.com/mail/u/0/#inbox" },
    { id: 2, title: "Pull Request · GitHub", url: "https://github.com/openai/openai/pull/1" }
  ];

  const result = normalizeTitleRewritePlan(
    {
      titles: [
        { tabId: 1, rewrittenTitle: "mail 收件箱" },
        { tabId: 1, rewrittenTitle: "重复项" },
        { tabId: 2, rewrittenTitle: "Pull Request · GitHub" },
        { tabId: 999, rewrittenTitle: "Ignore me" }
      ]
    },
    tabs
  );

  assert.deepEqual(result, [
    { tabId: 1, title: "收件箱" },
    { tabId: 2, title: "Pull Request" }
  ]);
});

test("cleanupRewrittenTitle 会去掉站点名前缀和多余分隔符", () => {
  assert.equal(
    cleanupRewrittenTitle("GitHub · Pull Request", {
      url: "https://github.com/openai/openai/pull/1"
    }),
    "Pull Request"
  );
});
