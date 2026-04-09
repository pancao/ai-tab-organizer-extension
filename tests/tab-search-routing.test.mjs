import test from "node:test";
import assert from "node:assert/strict";
import routing from "../tab-search-routing.js";

const {
  EXTENSION_PAGE_SEARCH_CHANNEL_NAME,
  EXTENSION_PAGE_SEARCH_REQUEST_STORAGE_KEY,
  EXTENSION_PAGE_SEARCH_RESPONSE_STORAGE_KEY,
  OPTIONS_PAGE_SEARCH_HASH_PREFIX,
  OPTIONS_PAGE_SEARCH_HASH_RESPONSE_STORAGE_KEY,
  EXTENSION_PAGE_PORT_NAME,
  TAB_SEARCH_DELIVERY,
  buildStandaloneSearchUrl,
  isExtensionPageSearchResponseMatch,
  isOptionsPagePortName,
  resolveOptionsPageConnectionTabId,
  resolveTabSearchDelivery,
  shouldBackgroundHandleRuntimeMessage
} = routing;

test("uses page overlay delivery for normal web pages", () => {
  const delivery = resolveTabSearchDelivery({
    url: "https://example.com/docs",
    blockedProtocols: ["chrome:", "edge:"],
    optionsPageUrl: "chrome-extension://test-extension/options.html"
  });

  assert.equal(delivery, TAB_SEARCH_DELIVERY.PAGE_OVERLAY);
});

test("uses extension page overlay delivery for the settings page", () => {
  const delivery = resolveTabSearchDelivery({
    url: "chrome-extension://test-extension/options.html",
    blockedProtocols: ["chrome:", "edge:"],
    optionsPageUrl: "chrome-extension://test-extension/options.html"
  });

  assert.equal(delivery, TAB_SEARCH_DELIVERY.EXTENSION_PAGE_OVERLAY);
});

test("falls back to the standalone window for blocked browser pages", () => {
  const delivery = resolveTabSearchDelivery({
    url: "chrome://extensions",
    blockedProtocols: ["chrome:", "edge:"],
    optionsPageUrl: "chrome-extension://test-extension/options.html"
  });

  assert.equal(delivery, TAB_SEARCH_DELIVERY.STANDALONE_WINDOW);
});

test("background runtime handler ignores extension page overlay handoff messages", () => {
  assert.equal(
    shouldBackgroundHandleRuntimeMessage({ type: "open-extension-tab-search" }),
    false
  );
  assert.equal(
    shouldBackgroundHandleRuntimeMessage({ type: "run-tab-search" }),
    true
  );
});

test("recognizes the dedicated options page port name", () => {
  assert.equal(isOptionsPagePortName(EXTENSION_PAGE_PORT_NAME), true);
  assert.equal(isOptionsPagePortName("something-else"), false);
});

test("exports the storage keys for extension page overlay handoff", () => {
  assert.equal(EXTENSION_PAGE_SEARCH_CHANNEL_NAME, "extension-page-tab-search");
  assert.equal(EXTENSION_PAGE_SEARCH_REQUEST_STORAGE_KEY, "extensionPageTabSearchRequest");
  assert.equal(EXTENSION_PAGE_SEARCH_RESPONSE_STORAGE_KEY, "extensionPageTabSearchResponse");
  assert.equal(OPTIONS_PAGE_SEARCH_HASH_PREFIX, "#tab-search-");
  assert.equal(OPTIONS_PAGE_SEARCH_HASH_RESPONSE_STORAGE_KEY, "optionsPageTabSearchHashResponse");
});

test("builds a standalone search url with fallback debug details", () => {
  const url = buildStandaloneSearchUrl(
    "chrome-extension://test-extension/search.html",
    "extension-overlay-timeout",
    {
      delivery: TAB_SEARCH_DELIVERY.EXTENSION_PAGE_OVERLAY,
      error: "options-port-timeout",
      sourceWindowId: 654,
      trace: "hash=options-hash-timeout | channel=options-channel-timeout | storage=options-storage-timeout | port=options-port-timeout",
      tabId: 321,
      sourceUrl: "chrome-extension://test-extension/options.html"
    }
  );

  assert.equal(
    url,
    "chrome-extension://test-extension/search.html?debug_reason=extension-overlay-timeout&debug_delivery=extension-page-overlay&debug_error=options-port-timeout&debug_tab_id=321&debug_source_url=chrome-extension%3A%2F%2Ftest-extension%2Foptions.html&debug_trace=hash%3Doptions-hash-timeout+%7C+channel%3Doptions-channel-timeout+%7C+storage%3Doptions-storage-timeout+%7C+port%3Doptions-port-timeout&sourceWindowId=654"
  );
});

test("prefers the sender tab id when binding an options page connection", () => {
  assert.equal(
    resolveOptionsPageConnectionTabId({
      senderTabId: 88,
      registeredTabId: 42
    }),
    88
  );
});

test("falls back to a registered tab id when sender tab id is missing", () => {
  assert.equal(
    resolveOptionsPageConnectionTabId({
      senderTabId: null,
      registeredTabId: 42
    }),
    42
  );
});

test("matches only storage responses for the active overlay request id", () => {
  assert.equal(
    isExtensionPageSearchResponseMatch({ requestId: "req-1", ok: true }, "req-1"),
    true
  );
  assert.equal(
    isExtensionPageSearchResponseMatch({ requestId: "req-2", ok: true }, "req-1"),
    false
  );
  assert.equal(
    isExtensionPageSearchResponseMatch({ requestId: "req-1" }, "req-1"),
    false
  );
});
