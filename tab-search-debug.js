(function attachTabSearchDebug(root, factory) {
  const api = factory();

  root.TabSearchDebug = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createTabSearchDebug() {
  const TAB_SEARCH_DEBUG_STORAGE_KEY = "tabSearchDebugEvents";
  const MAX_TAB_SEARCH_DEBUG_EVENTS = 120;

  function truncateDebugString(value, maxLength = 240) {
    const text = String(value ?? "");
    return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
  }

  function normalizeTabSearchDebugValue(value, depth = 0) {
    if (value == null) {
      return value;
    }

    if (typeof value === "string") {
      return truncateDebugString(value);
    }

    if (typeof value === "number" || typeof value === "boolean") {
      return value;
    }

    if (value instanceof Error) {
      return {
        name: value.name,
        message: truncateDebugString(value.message),
        stack: truncateDebugString(value.stack || "", 400)
      };
    }

    if (Array.isArray(value)) {
      if (depth >= 2) {
        return `[Array(${value.length})]`;
      }

      return value.slice(0, 12).map((item) => normalizeTabSearchDebugValue(item, depth + 1));
    }

    if (typeof value === "object") {
      if (depth >= 2) {
        return "[Object]";
      }

      return Object.fromEntries(
        Object.entries(value)
          .slice(0, 12)
          .map(([key, item]) => [key, normalizeTabSearchDebugValue(item, depth + 1)])
      );
    }

    return truncateDebugString(String(value));
  }

  function createTabSearchDebugEvent(source, event, details, at) {
    return {
      at: at || new Date().toISOString(),
      source: String(source || "unknown"),
      event: String(event || "event"),
      details: details === undefined ? undefined : normalizeTabSearchDebugValue(details)
    };
  }

  function appendTabSearchDebugEvent(events, entry, maxSize = MAX_TAB_SEARCH_DEBUG_EVENTS) {
    const nextEvents = Array.isArray(events) ? events.slice() : [];
    nextEvents.push(entry);

    if (nextEvents.length <= maxSize) {
      return nextEvents;
    }

    return nextEvents.slice(nextEvents.length - maxSize);
  }

  function formatTabSearchDebugEvent(entry) {
    const base = `[${entry?.at || ""}] ${entry?.source || "unknown"} ${entry?.event || "event"}`;

    if (entry?.details === undefined) {
      return base;
    }

    return `${base} ${JSON.stringify(entry.details)}`;
  }

  async function readTabSearchDebugEvents() {
    if (!globalThis.chrome?.storage?.local) {
      return [];
    }

    const stored = await chrome.storage.local.get(TAB_SEARCH_DEBUG_STORAGE_KEY);
    return Array.isArray(stored[TAB_SEARCH_DEBUG_STORAGE_KEY]) ? stored[TAB_SEARCH_DEBUG_STORAGE_KEY] : [];
  }

  async function clearTabSearchDebugEvents() {
    if (!globalThis.chrome?.storage?.local) {
      return;
    }

    await chrome.storage.local.remove(TAB_SEARCH_DEBUG_STORAGE_KEY);
  }

  async function recordTabSearchDebug(source, event, details) {
    const entry = createTabSearchDebugEvent(source, event, details);

    try {
      console.info("[TabSearchDebug]", formatTabSearchDebugEvent(entry));
    } catch (_error) {}

    if (!globalThis.chrome?.storage?.local) {
      return entry;
    }

    const events = await readTabSearchDebugEvents();
    const nextEvents = appendTabSearchDebugEvent(events, entry);
    await chrome.storage.local.set({
      [TAB_SEARCH_DEBUG_STORAGE_KEY]: nextEvents
    });

    return entry;
  }

  return {
    TAB_SEARCH_DEBUG_STORAGE_KEY,
    MAX_TAB_SEARCH_DEBUG_EVENTS,
    appendTabSearchDebugEvent,
    clearTabSearchDebugEvents,
    createTabSearchDebugEvent,
    formatTabSearchDebugEvent,
    readTabSearchDebugEvents,
    recordTabSearchDebug
  };
});
