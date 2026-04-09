import test from "node:test";
import assert from "node:assert/strict";
import debugApi from "../tab-search-debug.js";

const {
  MAX_TAB_SEARCH_DEBUG_EVENTS,
  appendTabSearchDebugEvent,
  createTabSearchDebugEvent,
  formatTabSearchDebugEvent
} = debugApi;

test("caps stored tab search debug events to the configured max size", () => {
  const events = Array.from({ length: MAX_TAB_SEARCH_DEBUG_EVENTS }, (_, index) =>
    createTabSearchDebugEvent("background", `event-${index}`, { index }, `2026-04-08T00:00:${String(index).padStart(2, "0")}Z`)
  );

  const appended = appendTabSearchDebugEvent(
    events,
    createTabSearchDebugEvent("options", "latest", { step: "after-cap" }, "2026-04-08T00:10:00Z")
  );

  assert.equal(appended.length, MAX_TAB_SEARCH_DEBUG_EVENTS);
  assert.equal(appended[0].event, "event-1");
  assert.equal(appended.at(-1)?.event, "latest");
});

test("formats a readable single-line debug log entry", () => {
  const line = formatTabSearchDebugEvent(
    createTabSearchDebugEvent("content", "overlay-opened", {
      mode: "shadow",
      href: "https://example.com/docs"
    }, "2026-04-08T12:34:56.000Z")
  );

  assert.equal(
    line,
    '[2026-04-08T12:34:56.000Z] content overlay-opened {"mode":"shadow","href":"https://example.com/docs"}'
  );
});
