import test from "node:test";
import assert from "node:assert/strict";
import * as backgroundCore from "../background-core.mjs";

const { getCandidateTabs } = backgroundCore;

test("getCandidateTabs keeps only non-pinned http/https tabs", () => {
  const tabs = [
    { id: 1, pinned: false, url: "https://example.com/a" },
    { id: 2, pinned: false, url: "http://example.com/b" },
    { id: 3, pinned: true, url: "https://example.com/c" },
    { id: 4, pinned: false, url: "chrome://settings" },
    { id: 5, pinned: false, url: "chrome-extension://abc/popup.html" },
    { id: 6, pinned: false, url: "file:///Users/demo/test.html" },
    { id: 7, pinned: false, url: "about:blank" },
    { id: 8, pinned: false, url: "", pendingUrl: "https://pending.example.com" }
  ];

  assert.deepEqual(
    getCandidateTabs(tabs).map((tab) => tab.id),
    [1, 2, 8]
  );
});
