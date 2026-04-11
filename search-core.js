(function attachTabSearchCore(root, factory) {
  const api = factory();

  root.AITabSearchCore = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createTabSearchCore() {
  const i18n = typeof globalThis !== "undefined" ? globalThis.AITabI18n : null;
  const SEARCH_ACTIONS = Object.freeze(["open", "close", "bookmark_close"]);
  const FALLBACK_MESSAGES = Object.freeze({
    settings: "设置",
    commandSettingsSubtitle: "设置主题色、服务商、AI 接口、语言和整理偏好",
    commandArrangeTitle: "整理标签页",
    commandArrangeSubtitle: "智能整理并分组所有标签页",
    search: "搜索",
    commandNaturalTitle: "自然语言智能搜索",
    commandNaturalSubtitle: "“所有谷歌文档”、“3天没打开过的标签”",
    openUrl: "打开网址"
  });

  function getText(locale, key, vars) {
    if (i18n?.t) {
      return i18n.t(locale, key, vars);
    }

    return FALLBACK_MESSAGES[key] || key;
  }

  function buildEntries(tabs, query, locale = "cn") {
    const entries = [];
    const trimmed = String(query || "").trim();
    const normalized = trimmed.toLowerCase();
    const settingsMatched = isSettingsCommand(trimmed, normalized);

    if (settingsMatched) {
      entries.push({
        id: "command-settings",
        kind: "command",
        command: "settings",
        title: getText(locale, "settings"),
        subtitle: getText(locale, "commandSettingsSubtitle")
      });
    }

    if (settingsMatched) {
      return entries;
    }

    if (normalized === "arrange") {
      entries.push({
        id: "command-arrange",
        kind: "command",
        command: "arrange",
        title: getText(locale, "commandArrangeTitle"),
        subtitle: getText(locale, "commandArrangeSubtitle")
      });
    }

    const filteredTabs = filterTabs(Array.isArray(tabs) ? tabs : [], trimmed);
    const matchingTabs = filteredTabs.map((tab) => ({
      id: `tab-${tab.id}`,
      kind: "tab",
      tabId: tab.id,
      title: tab.title,
      subtitle: tab.url,
      favIconUrl: tab.favIconUrl || "",
      lastAccessed: tab.lastAccessed || null
    }));

    entries.push(...matchingTabs);

    const topScore = filteredTabs.length > 0 ? filteredTabs[0].score : 0;
    const isWeakMatch = trimmed && matchingTabs.length > 0 && topScore < 3;
    const noMatch = trimmed && matchingTabs.length === 0;
    const fallbackTarget = (noMatch || isWeakMatch) ? buildFallbackTarget(trimmed, locale) : null;

    if (fallbackTarget) {
      entries.push({
        id: `fallback-${fallbackTarget.value}`,
        kind: "url",
        url: fallbackTarget.value,
        title: fallbackTarget.title,
        subtitle: fallbackTarget.subtitle,
        isSearch: fallbackTarget.title === getText(locale, "search")
      });
    }

    if (shouldShowNaturalSearchCommand(trimmed, normalized)) {
      const naturalEntry = {
        id: `natural-${trimmed}`,
        kind: "command",
        command: "natural-search",
        title: getText(locale, "commandNaturalTitle"),
        subtitle: getText(locale, "commandNaturalSubtitle")
      };
      const insertIndex = fallbackTarget ? entries.length : Math.min(1, entries.length);
      entries.splice(insertIndex, 0, naturalEntry);
    }

    return entries;
  }

  function buildNaturalEntries(preview) {
    return (preview?.tabs || []).map((tab) => ({
      id: `tab-${tab.id}`,
      kind: "tab",
      tabId: tab.id,
      title: tab.title,
      subtitle: tab.url,
      favIconUrl: tab.favIconUrl || "",
      lastAccessed: tab.lastAccessed || null
    }));
  }

  function defaultActionForEntry(entry) {
    return entry.kind === "tab" ? "open" : "run";
  }

  function supportsActions(entry) {
    return entry?.kind === "tab";
  }

  function normalizeIndex(index, entries) {
    if (index === -1) {
      return -1;
    }

    if ((entries || []).length === 0) {
      return 0;
    }

    return Math.max(0, Math.min(index, entries.length - 1));
  }

  function cycleAction(currentAction, direction) {
    if (!currentAction) {
      return direction === "backward" ? SEARCH_ACTIONS[SEARCH_ACTIONS.length - 1] : SEARCH_ACTIONS[0];
    }

    const currentIndex = SEARCH_ACTIONS.indexOf(currentAction);

    if (currentIndex === -1) {
      return SEARCH_ACTIONS[0];
    }

    if (direction === "backward") {
      return SEARCH_ACTIONS[(currentIndex - 1 + SEARCH_ACTIONS.length) % SEARCH_ACTIONS.length];
    }

    return SEARCH_ACTIONS[(currentIndex + 1) % SEARCH_ACTIONS.length];
  }

  function shouldShowNaturalSearchCommand(query, normalizedQuery) {
    if (!query || normalizedQuery === "arrange") {
      return false;
    }

    return getNaturalSearchScore(query) >= 4;
  }

  function getNaturalSearchScore(value) {
    return Array.from(String(value || "")).reduce(
      (total, char) => total + (/[\u3400-\u9fff]/u.test(char) ? 2 : 1),
      0
    );
  }

  function isSettingsCommand(query, normalizedQuery) {
    return (
      String(query || "").includes("设置") ||
      String(query || "").includes("設定") ||
      String(query || "").includes("設置") ||
      String(query || "").includes("设定") ||
      String(query || "").includes("configuración") ||
      String(query || "").includes("configuracion") ||
      String(query || "").includes("ajustes") ||
      String(query || "").includes("設定") ||
      normalizedQuery.startsWith("set") ||
      normalizedQuery.includes("config") ||
      normalizedQuery.includes("ajuste") ||
      normalizedQuery.includes("settings") ||
      normalizedQuery.includes("setting")
    );
  }

  function filterTabs(tabs, query) {
    if (!query) {
      return tabs;
    }

    const tokens = String(query)
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);

    return tabs
      .map((tab) => {
        const haystack = `${tab.title} ${tab.url}`.toLowerCase();
        const score = tokens.reduce((total, token) => {
          if (haystack.includes(token)) {
            return total + (String(tab.title || "").toLowerCase().includes(token) ? 3 : 1);
          }

          return total;
        }, 0);

        return { ...tab, score };
      })
      .filter((tab) => tab.score > 0)
      .sort((left, right) => right.score - left.score);
  }

  function normalizeUrl(value) {
    if (!value || /\s/.test(value)) {
      return null;
    }

    try {
      const url = value.includes("://") ? new URL(value) : new URL(`https://${value}`);
      return /^https?:$/.test(url.protocol) ? url.toString() : null;
    } catch (_error) {
      return null;
    }
  }

  function buildFallbackTarget(value, locale = "cn") {
    const normalized = isLikelyUrl(value) ? normalizeUrl(value) : null;

    if (normalized) {
      return {
        value: normalized,
        title: getText(locale, "openUrl"),
        subtitle: normalized
      };
    }

    return {
      value,
      title: getText(locale, "search"),
      subtitle: value
    };
  }

  function isLikelyUrl(value) {
    const input = String(value || "").trim();

    if (!input || /\s/.test(input)) {
      return false;
    }

    if (/^https?:\/\//i.test(input)) {
      return true;
    }

    return /^(localhost(?::\d+)?|(\d{1,3}\.){3}\d{1,3}(?::\d+)?|[a-z0-9-]+(\.[a-z0-9-]+)+)(\/.*)?$/i.test(input);
  }

  return Object.freeze({
    SEARCH_ACTIONS,
    buildEntries,
    buildFallbackTarget,
    buildNaturalEntries,
    cycleAction,
    defaultActionForEntry,
    filterTabs,
    getNaturalSearchScore,
    isLikelyUrl,
    isSettingsCommand,
    normalizeIndex,
    normalizeUrl,
    shouldShowNaturalSearchCommand,
    supportsActions
  });
});
