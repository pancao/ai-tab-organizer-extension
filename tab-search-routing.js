(function attachTabSearchRouting(root, factory) {
  const api = factory();

  root.TabSearchRouting = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createTabSearchRouting() {
  const EXTENSION_PAGE_SEARCH_CHANNEL_NAME = "extension-page-tab-search";
  const OPTIONS_PAGE_SEARCH_HASH_PREFIX = "#tab-search-";
  const OPTIONS_PAGE_SEARCH_HASH_RESPONSE_STORAGE_KEY = "optionsPageTabSearchHashResponse";
  const EXTENSION_PAGE_PORT_NAME = "options-page-tab-search";
  const EXTENSION_PAGE_SEARCH_REQUEST_STORAGE_KEY = "extensionPageTabSearchRequest";
  const EXTENSION_PAGE_SEARCH_RESPONSE_STORAGE_KEY = "extensionPageTabSearchResponse";
  const TAB_SEARCH_DELIVERY = Object.freeze({
    PAGE_OVERLAY: "page-overlay",
    EXTENSION_PAGE_OVERLAY: "extension-page-overlay",
    STANDALONE_WINDOW: "standalone-window"
  });

  function resolveTabSearchDelivery({ url, blockedProtocols, optionsPageUrl }) {
    const normalizedUrl = String(url || "").trim();
    const blocked = Array.isArray(blockedProtocols) ? blockedProtocols : [];
    const normalizedOptionsPageUrl = String(optionsPageUrl || "").trim();

    if (!normalizedUrl) {
      return TAB_SEARCH_DELIVERY.STANDALONE_WINDOW;
    }

    if (blocked.some((protocol) => normalizedUrl.startsWith(protocol))) {
      return TAB_SEARCH_DELIVERY.STANDALONE_WINDOW;
    }

    if (normalizedOptionsPageUrl && normalizedUrl.startsWith(normalizedOptionsPageUrl)) {
      return TAB_SEARCH_DELIVERY.EXTENSION_PAGE_OVERLAY;
    }

    return TAB_SEARCH_DELIVERY.PAGE_OVERLAY;
  }

  function shouldBackgroundHandleRuntimeMessage(message) {
    return message?.type !== "open-extension-tab-search";
  }

  function isOptionsPagePortName(name) {
    return String(name || "") === EXTENSION_PAGE_PORT_NAME;
  }

  function normalizeTabId(value) {
    const nextValue = Number(value);
    return Number.isInteger(nextValue) && nextValue > 0 ? nextValue : null;
  }

  function resolveOptionsPageConnectionTabId({ senderTabId, registeredTabId }) {
    return normalizeTabId(senderTabId) || normalizeTabId(registeredTabId);
  }

  function isExtensionPageSearchResponseMatch(response, requestId) {
    return String(response?.requestId || "") === String(requestId || "")
      && typeof response?.ok === "boolean";
  }

  function buildStandaloneSearchUrl(baseUrl, reason, context) {
    const originalBaseUrl = String(baseUrl || "");
    const url = new URL(originalBaseUrl, "https://example.invalid");
    const details = context || {};

    if (reason) {
      url.searchParams.set("debug_reason", String(reason));
    }

    if (details.delivery) {
      url.searchParams.set("debug_delivery", String(details.delivery));
    }

    if (details.error) {
      url.searchParams.set("debug_error", String(details.error));
    }

    if (details.tabId != null) {
      url.searchParams.set("debug_tab_id", String(details.tabId));
    }

    if (details.sourceUrl) {
      url.searchParams.set("debug_source_url", String(details.sourceUrl));
    }

    if (details.trace) {
      url.searchParams.set("debug_trace", String(details.trace));
    }

    if (details.sourceWindowId != null) {
      url.searchParams.set("sourceWindowId", String(details.sourceWindowId));
    }

    if (originalBaseUrl.startsWith("chrome-extension://")) {
      return `${url.protocol}//${url.host}${url.pathname}${url.search}`;
    }

    return url.toString();
  }

  return {
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
  };
});
