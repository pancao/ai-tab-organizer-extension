const OVERLAY_ID = "__ai_tab_organizer_search_overlay__";
const ACTIONS = ["open", "close", "bookmark_close"];
const NATURAL_BATCH_ACTIONS = [
  { action: "bookmark_close", label: "关闭全部并收藏" },
  { action: "delete", label: "关闭所有" },
  { action: "group", label: "新建分组" }
];
const UI_FONT_FAMILY = '"Inter", sans-serif';

const _ic = (d) => `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex:0 0 auto">${d}</svg>`;
const BUTTON_ICONS = {
  "整理标签页": _ic('<path d="M15 4V2"/><path d="M15 16v-2"/><path d="M8 9h2"/><path d="M20 9h2"/><path d="M17.8 11.8 19 13"/><path d="M15 9h.01"/><path d="M17.8 6.2 19 5"/><path d="m3 21 9-9"/><path d="M12.2 6.2 11 5"/>'),
  "设置": _ic('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>'),
  "打开": _ic('<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>'),
  "关闭": _ic('<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>'),
  "收藏后关闭": _ic('<path d="m19 21-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>'),
  "关闭全部并收藏": _ic('<path d="m19 21-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>'),
  "关闭所有": _ic('<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>'),
  "新建分组": _ic('<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/>'),
  "保存设置": _ic('<polyline points="20 6 9 17 4 12"/>'),
  "保存并立即整理标签页": _ic('<path d="M15 4V2"/><path d="M15 16v-2"/><path d="M8 9h2"/><path d="M20 9h2"/><path d="M17.8 11.8 19 13"/><path d="M15 9h.01"/><path d="M17.8 6.2 19 5"/><path d="m3 21 9-9"/><path d="M12.2 6.2 11 5"/>'),
};

const THEME_COLORS_CONFIG = {
  neutral: { accent: "#1f1f1c", light: { page: "#f6f6f4", surface: "rgba(255,255,255,0.72)", inputBg: "rgba(255,255,255,0.82)", border: "rgba(15,23,42,0.12)", text: "#0f172a", muted: "rgba(15,23,42,0.56)", subtleBg: "rgba(15,23,42,0.07)", hoverBg: "rgba(15,23,42,0.18)", selectedBg: "rgba(15,23,42,0.13)", overlayBg: "rgba(15,23,42,0.16)", commandBg: "rgba(37,99,235,0.08)", commandText: "#1d4ed8", commandMuted: "rgba(29,78,216,0.78)", urlShadow: "rgba(37,99,235,0.10)" }, dark: { page: "#1a1a1a", surface: "rgba(30,30,30,0.88)", inputBg: "rgba(40,40,40,0.82)", border: "rgba(255,255,255,0.12)", text: "#e5e5e5", muted: "rgba(255,255,255,0.50)", subtleBg: "rgba(255,255,255,0.07)", hoverBg: "rgba(255,255,255,0.22)", selectedBg: "rgba(255,255,255,0.18)", overlayBg: "rgba(0,0,0,0.50)", commandBg: "rgba(96,165,250,0.10)", commandText: "#93bbfd", commandMuted: "rgba(147,187,253,0.78)", urlShadow: "rgba(96,165,250,0.10)" } },
  blue: { accent: "#2563eb", light: { page: "#f0f4ff", surface: "rgba(240,245,255,0.82)", inputBg: "rgba(255,255,255,0.82)", border: "rgba(37,99,235,0.14)", text: "#0f172a", muted: "rgba(37,99,235,0.50)", subtleBg: "rgba(37,99,235,0.07)", hoverBg: "rgba(37,99,235,0.20)", selectedBg: "rgba(37,99,235,0.20)", overlayBg: "rgba(16,24,40,0.18)", commandBg: "rgba(37,99,235,0.10)", commandText: "#1d4ed8", commandMuted: "rgba(29,78,216,0.78)", urlShadow: "rgba(37,99,235,0.12)" }, dark: { page: "#101828", surface: "rgba(26,37,64,0.88)", inputBg: "rgba(30,42,72,0.82)", border: "rgba(96,165,250,0.16)", text: "#e5e5e5", muted: "rgba(147,187,253,0.55)", subtleBg: "rgba(96,165,250,0.08)", hoverBg: "rgba(96,165,250,0.26)", selectedBg: "rgba(96,165,250,0.26)", overlayBg: "rgba(0,0,0,0.50)", commandBg: "rgba(96,165,250,0.12)", commandText: "#93bbfd", commandMuted: "rgba(147,187,253,0.78)", urlShadow: "rgba(96,165,250,0.10)" } },
  green: { accent: "#16a34a", light: { page: "#eefbf2", surface: "rgba(238,251,242,0.82)", inputBg: "rgba(255,255,255,0.82)", border: "rgba(22,163,74,0.14)", text: "#0f172a", muted: "rgba(22,163,74,0.52)", subtleBg: "rgba(22,163,74,0.07)", hoverBg: "rgba(22,163,74,0.20)", selectedBg: "rgba(22,163,74,0.20)", overlayBg: "rgba(14,31,20,0.18)", commandBg: "rgba(22,163,74,0.10)", commandText: "#15803d", commandMuted: "rgba(21,128,61,0.78)", urlShadow: "rgba(22,163,74,0.12)" }, dark: { page: "#0e1f14", surface: "rgba(21,42,28,0.88)", inputBg: "rgba(26,48,34,0.82)", border: "rgba(74,222,128,0.14)", text: "#e5e5e5", muted: "rgba(134,239,172,0.55)", subtleBg: "rgba(74,222,128,0.08)", hoverBg: "rgba(74,222,128,0.26)", selectedBg: "rgba(74,222,128,0.24)", overlayBg: "rgba(0,0,0,0.50)", commandBg: "rgba(74,222,128,0.10)", commandText: "#86efac", commandMuted: "rgba(134,239,172,0.78)", urlShadow: "rgba(74,222,128,0.10)" } },
  purple: { accent: "#7c3aed", light: { page: "#f5f0ff", surface: "rgba(245,240,255,0.82)", inputBg: "rgba(255,255,255,0.82)", border: "rgba(124,58,237,0.14)", text: "#0f172a", muted: "rgba(124,58,237,0.50)", subtleBg: "rgba(124,58,237,0.07)", hoverBg: "rgba(124,58,237,0.20)", selectedBg: "rgba(124,58,237,0.20)", overlayBg: "rgba(24,16,42,0.18)", commandBg: "rgba(124,58,237,0.10)", commandText: "#6d28d9", commandMuted: "rgba(109,40,217,0.78)", urlShadow: "rgba(124,58,237,0.12)" }, dark: { page: "#18102a", surface: "rgba(34,24,64,0.88)", inputBg: "rgba(40,30,72,0.82)", border: "rgba(167,139,250,0.16)", text: "#e5e5e5", muted: "rgba(196,181,253,0.55)", subtleBg: "rgba(167,139,250,0.08)", hoverBg: "rgba(167,139,250,0.26)", selectedBg: "rgba(167,139,250,0.26)", overlayBg: "rgba(0,0,0,0.50)", commandBg: "rgba(167,139,250,0.12)", commandText: "#c4b5fd", commandMuted: "rgba(196,181,253,0.78)", urlShadow: "rgba(167,139,250,0.10)" } },
  orange: { accent: "#ea580c", light: { page: "#fff6ed", surface: "rgba(255,246,237,0.82)", inputBg: "rgba(255,255,255,0.82)", border: "rgba(234,88,12,0.14)", text: "#0f172a", muted: "rgba(234,88,12,0.50)", subtleBg: "rgba(234,88,12,0.07)", hoverBg: "rgba(234,88,12,0.20)", selectedBg: "rgba(234,88,12,0.20)", overlayBg: "rgba(31,18,8,0.18)", commandBg: "rgba(234,88,12,0.10)", commandText: "#c2410c", commandMuted: "rgba(194,65,12,0.78)", urlShadow: "rgba(234,88,12,0.12)" }, dark: { page: "#1f1208", surface: "rgba(42,26,16,0.88)", inputBg: "rgba(48,32,21,0.82)", border: "rgba(251,146,60,0.16)", text: "#e5e5e5", muted: "rgba(253,186,116,0.55)", subtleBg: "rgba(251,146,60,0.08)", hoverBg: "rgba(251,146,60,0.26)", selectedBg: "rgba(251,146,60,0.26)", overlayBg: "rgba(0,0,0,0.50)", commandBg: "rgba(251,146,60,0.12)", commandText: "#fdba74", commandMuted: "rgba(253,186,116,0.78)", urlShadow: "rgba(251,146,60,0.10)" } }
};

const THEME_SWATCH_COLORS = [
  { key: "neutral", bg: "#1f1f1c", label: "默认" },
  { key: "blue", bg: "#2563eb", label: "蓝色" },
  { key: "green", bg: "#16a34a", label: "绿色" },
  { key: "purple", bg: "#7c3aed", label: "紫色" },
  { key: "orange", bg: "#ea580c", label: "橙色" }
];

async function getThemeTokens() {
  const { themeColor, themeMode } = await chrome.storage.local.get(["themeColor", "themeMode"]);
  const color = themeColor || "neutral";
  const mode = themeMode || "light";
  const config = THEME_COLORS_CONFIG[color] || THEME_COLORS_CONFIG.neutral;
  return { tokens: config[mode] || config.light, accent: config.accent, color, mode };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "open-tab-search") {
    openTabSearch(message.tabs);
    sendResponse({ ok: true });
  }
});

async function openTabSearch(prefetchedTabs) {
  const existing = document.getElementById(OVERLAY_ID);

  if (existing) {
    existing.remove();
    return;
  }

  let tabs;
  let theme;

  if (prefetchedTabs) {
    tabs = prefetchedTabs;
    theme = await getThemeTokens();
  } else {
    const [response, theme0] = await Promise.all([
      chrome.runtime.sendMessage({ type: "get-tabs" }),
      getThemeTokens()
    ]);
    if (!response?.ok) return;
    tabs = response.tabs || [];
    theme = theme0;
  }

  let entries = [];
  let selectedIndex = -1;
  let selectedAction = null;
  let hoveredIndex = null;
  let rowNodes = [];
  let headerFocusIndex = -1;
  let footerFocusIndex = -1;
  let footerButtons = [];
  let searchMode = "default";
  let naturalPreview = null;
  let isNaturalLoading = false;

  let t = theme.tokens;

  async function reloadTheme() {
    theme = await getThemeTokens();
    t = theme.tokens;
  }

  const overlay = document.createElement("div");
  overlay.id = OVERLAY_ID;
  setStyles(overlay, {
    position: "fixed",
    inset: "0",
    zIndex: "2147483647",
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "center",
    padding: "12vh 16px 24px",
    overflow: "hidden",
    background: t.overlayBg,
    backdropFilter: "blur(10px)",
    webkitBackdropFilter: "blur(10px)",
    fontFamily: UI_FONT_FAMILY
  });

  const panel = document.createElement("div");
  setStyles(panel, {
    position: "relative",
    width: "min(700px, calc(100vw - 32px))",
    maxWidth: "700px",
    maxHeight: "72vh",
    overflow: "hidden",
    overflowX: "hidden",
    borderRadius: "60px",
    cornerShape: "superellipse(2.1)",
    background: t.surface,
    backdropFilter: "blur(24px)",
    webkitBackdropFilter: "blur(24px)",
    border: `1px solid ${t.border}`,
    boxShadow: "0 24px 80px rgba(15, 23, 42, 0.22)",
    display: "flex",
    flexDirection: "column",
    fontFamily: UI_FONT_FAMILY
  });

  const toolbar = document.createElement("div");
  setStyles(toolbar, {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "16px 16px 8px",
    minWidth: "0"
  });

  const inputWrapper = document.createElement("div");
  setStyles(inputWrapper, {
    flex: "1 1 auto",
    minWidth: "0",
    position: "relative",
    display: "flex",
    alignItems: "center"
  });

  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = "通过关键词、网址、或一句话搜索标签";
  input.autocomplete = "off";
  input.spellcheck = false;
  input.autocapitalize = "off";
  input.autocorrect = "off";
  input.enterKeyHint = "search";
  input.name = "ai-tab-organizer-search";
  input.setAttribute("data-lpignore", "true");
  input.setAttribute("data-1p-ignore", "true");
  input.setAttribute("data-form-type", "other");
  setStyles(input, {
    flex: "1 1 auto",
    width: "100%",
    minWidth: "0",
    border: "0",
    outline: "none",
    background: "transparent",
    padding: "12px 36px 12px 14px",
    fontSize: "18px",
    color: t.text,
    fontFamily: UI_FONT_FAMILY
  });

  const clearButton = document.createElement("button");
  clearButton.type = "button";
  clearButton.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
  setStyles(clearButton, {
    position: "absolute",
    right: "8px",
    display: "none",
    alignItems: "center",
    justifyContent: "center",
    width: "22px",
    height: "22px",
    border: "0",
    borderRadius: "50%",
    background: t.subtleBg,
    color: t.muted,
    cursor: "pointer",
    padding: "0",
    flex: "0 0 auto"
  });
  clearButton.addEventListener("click", () => {
    input.value = "";
    input.dispatchEvent(new Event("input"));
    input.focus();
  });

  inputWrapper.appendChild(input);
  inputWrapper.appendChild(clearButton);

  const arrangeButton = createToolbarButton("整理标签页", async () => {
    setToolbarButtonBusy(arrangeButton, true, "整理中…");

    try {
      await chrome.runtime.sendMessage({ type: "run-ai-organization" });
      close();
    } finally {
      setToolbarButtonBusy(arrangeButton, false, "整理标签页");
    }
  }, t);

  const settingsButton = createToolbarButton("设置", async () => {
    await enterSettingsView();
  }, t);
  settingsButton.innerHTML = BUTTON_ICONS["设置"];
  settingsButton.title = "设置";
  setStyles(settingsButton, { padding: "10px" });

  const headerButtons = [arrangeButton, settingsButton];

  toolbar.appendChild(inputWrapper);
  toolbar.appendChild(arrangeButton);
  toolbar.appendChild(settingsButton);

  const list = document.createElement("div");
  setStyles(list, {
    padding: "0 8px 10px 10px",
    flex: "1 1 auto",
    minHeight: "0",
    overflowY: "auto",
    overflowX: "hidden",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    minWidth: "0",
    maxWidth: "100%",
    fontFamily: UI_FONT_FAMILY
  });

  const footer = document.createElement("div");
  setStyles(footer, {
    display: "none",
    position: "absolute",
    bottom: "0",
    left: "0",
    right: "0",
    alignItems: "center",
    gap: "8px",
    padding: "12px 16px 16px",
    minWidth: "0",
    overflowX: "auto",
    overflowY: "hidden",
    background: t.surface,
    backdropFilter: "blur(12px)",
    webkitBackdropFilter: "blur(12px)",
    borderTop: `1px solid ${t.border}`
  });

  const placeholderStyle = document.createElement("style");
  placeholderStyle.textContent = `#${OVERLAY_ID} input::placeholder { color: ${t.commandText}; opacity: 0.45; }`;
  panel.appendChild(placeholderStyle);
  panel.appendChild(toolbar);
  panel.appendChild(list);
  panel.appendChild(footer);
  overlay.appendChild(panel);
  document.documentElement.appendChild(overlay);

  const close = () => overlay.remove();

  list.addEventListener("mouseleave", () => {
    hoveredIndex = null;
    selectedIndex = -1;
    selectedAction = null;
    updateInteractiveState();
  });

  input.addEventListener("input", () => {
    clearButton.style.display = input.value ? "flex" : "none";

    searchMode = "default";
    naturalPreview = null;
    headerFocusIndex = -1;
    footerFocusIndex = -1;
    selectedIndex = -1;
    selectedAction = null;
    hoveredIndex = null;

    rebuildRows();

    if (input.value.trim() && entries.length > 0) {
      selectedIndex = 0;
      updateInteractiveState();
    }
  });

  input.addEventListener("keydown", async (event) => {
    const totalItems = entries.length;
    const activeEntry = entries[selectedIndex];
    const hasActiveTabEntry = supportsActions(activeEntry);

    if (event.key === "Escape") {
      if (searchMode === "natural" || searchMode === "settings") {
        searchMode = "default";
        naturalPreview = null;
        headerFocusIndex = -1;
        footerFocusIndex = -1;
        selectedIndex = -1;
        selectedAction = null;
        hoveredIndex = null;

        rebuildRows();
        return;
      }

      close();
      return;
    }

    if (event.key === "ArrowRight" && hasActiveTabEntry) {
      event.preventDefault();
      headerFocusIndex = -1;
      hoveredIndex = null;
      selectedAction = cycleAction(selectedAction, "forward");
      updateInteractiveState();
      return;
    }

    if (event.key === "ArrowLeft" && hasActiveTabEntry) {
      event.preventDefault();
      headerFocusIndex = -1;
      hoveredIndex = null;
      selectedAction = cycleAction(selectedAction, "backward");
      updateInteractiveState();
      return;
    }

    if (event.key === "ArrowRight" && footerFocusIndex > -1) {
      event.preventDefault();
      footerFocusIndex = (footerFocusIndex + 1) % footerButtons.length;
      updateInteractiveState();
      return;
    }

    if (event.key === "ArrowLeft" && footerFocusIndex > -1) {
      event.preventDefault();
      footerFocusIndex = (footerFocusIndex - 1 + footerButtons.length) % footerButtons.length;
      updateInteractiveState();
      return;
    }

    if (event.key === "ArrowRight" && headerFocusIndex === -1 && !hasActiveTabEntry && isCaretAtEnd(input)) {
      event.preventDefault();
      footerFocusIndex = -1;
      headerFocusIndex = 0;
      hoveredIndex = null;
      updateInteractiveState();
      return;
    }

    if (event.key === "ArrowLeft" && headerFocusIndex > -1) {
      event.preventDefault();
      headerFocusIndex = headerFocusIndex === 0 ? -1 : headerFocusIndex - 1;
      updateInteractiveState();
      if (headerFocusIndex === -1) {
        input.focus();
      }
      return;
    }

    if (event.key === "ArrowRight" && headerFocusIndex > -1) {
      event.preventDefault();
      headerFocusIndex = (headerFocusIndex + 1) % headerButtons.length;
      updateInteractiveState();
      return;
    }

    if (event.key === "Enter" && headerFocusIndex > -1) {
      event.preventDefault();
      await headerButtons[headerFocusIndex].click();
      return;
    }

    if (event.key === "ArrowDown" && headerFocusIndex > -1) {
      event.preventDefault();
      headerFocusIndex = -1;
      updateInteractiveState();
      return;
    }

    if (event.key === "ArrowDown" && totalItems > 0) {
      event.preventDefault();
      headerFocusIndex = -1;
      footerFocusIndex = -1;
      hoveredIndex = null;

      if (selectedIndex === -1) {
        selectedIndex = 0;
        if (!supportsActions(entries[selectedIndex])) {
          selectedAction = null;
        }
        updateInteractiveState();
        return;
      }

      if (selectedIndex === totalItems - 1 && hasNaturalBatchActions()) {
        selectedIndex = -1;
        selectedAction = null;
        footerFocusIndex = 0;
        updateInteractiveState();
        return;
      }

      if (selectedIndex === totalItems - 1) {
        selectedIndex = -1;
        selectedAction = null;
        input.focus();
        updateInteractiveState();
        return;
      }

      selectedIndex += 1;
      if (!supportsActions(entries[selectedIndex])) {
        selectedAction = null;
      }
      updateInteractiveState();
      return;
    }

    if (event.key === "ArrowUp" && footerFocusIndex > -1) {
      event.preventDefault();
      footerFocusIndex = -1;
      selectedIndex = totalItems > 0 ? totalItems - 1 : -1;
      selectedAction = null;
      updateInteractiveState();
      return;
    }

    if (event.key === "ArrowUp" && totalItems > 0) {
      event.preventDefault();
      headerFocusIndex = -1;
      footerFocusIndex = -1;
      hoveredIndex = null;

      if (selectedIndex === 0) {
        selectedIndex = -1;
        selectedAction = null;
        input.focus();
        updateInteractiveState();
        return;
      }

      selectedIndex = selectedIndex === -1 ? totalItems - 1 : selectedIndex - 1;
      if (!supportsActions(entries[selectedIndex])) {
        selectedAction = null;
      }
      updateInteractiveState();
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();

      if (footerFocusIndex > -1) {
        await executeNaturalBatchAction(NATURAL_BATCH_ACTIONS[footerFocusIndex]?.action);
        return;
      }

      const fallbackIndex = selectedIndex === -1 && input.value.trim() && entries.length > 0 ? 0 : selectedIndex;
      const entry = entries[fallbackIndex];

      if (!entry) {
        return;
      }

      headerFocusIndex = -1;
      selectedIndex = fallbackIndex;
      const action = supportsActions(entry) ? selectedAction || "open" : defaultActionForEntry(entry);
      await executeEntryAction(entry, action);
    }
  });

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      close();
    }
  });

  function rebuildRows() {
    if (isNaturalLoading) {
      renderFooter();
      renderLoadingState();
      return;
    }

    if (searchMode === "settings") {
      renderFooter();
      renderSettingsView();
      return;
    }

    entries = searchMode === "natural" && naturalPreview ? buildNaturalEntries(naturalPreview) : buildEntries(tabs, input.value.trim());
    selectedIndex = normalizeIndex(selectedIndex, entries);

    if (!supportsActions(entries[selectedIndex])) {
      selectedAction = null;
    }

    rowNodes = [];
    list.textContent = "";
    renderFooter();

    if (entries.length === 0) {
      const empty = document.createElement("div");
      empty.textContent = searchMode === "natural" ? "自然语言搜索没有找到匹配标签页" : "没有匹配的标签页";
      setStyles(empty, {
        padding: "12px 14px 16px",
        flex: "0 0 auto",
        color: t.muted,
        fontSize: "13px",
        fontFamily: UI_FONT_FAMILY
      });
      list.appendChild(empty);
      return;
    }

    entries.forEach((entry, index) => {
      const row = createRow(entry, index);
      rowNodes.push(row);
      list.appendChild(row.item);
    });

    updateInteractiveState();
  }

  function renderLoadingState() {
    entries = [];
    rowNodes = [];
    list.textContent = "";

    const loading = document.createElement("div");
    setStyles(loading, {
      display: "flex",
      flex: "0 0 auto",
      alignItems: "center",
      gap: "12px",
      padding: "12px 14px 16px",
      color: t.muted,
      fontSize: "13px",
      fontFamily: UI_FONT_FAMILY
    });

    const spinner = document.createElement("div");
    setStyles(spinner, {
      width: "16px",
      height: "16px",
      borderRadius: "999px",
      border: `2px solid ${t.border}`,
      borderTopColor: t.text,
      flex: "0 0 auto",
      animation: "ai-tab-organizer-spin 0.7s linear infinite"
    });

    const label = document.createElement("div");
    label.textContent = "正在进行自然语言搜索…";

    loading.appendChild(spinner);
    loading.appendChild(label);
    list.appendChild(loading);
  }

  async function enterSettingsView() {
    searchMode = "settings";
    naturalPreview = null;
    headerFocusIndex = -1;
    footerFocusIndex = -1;
    selectedIndex = -1;
    selectedAction = null;
    hoveredIndex = null;

    renderFooter();
    renderSettingsView();
  }

  function renderSettingsView() {
    entries = [];
    rowNodes = [];
    list.textContent = "";

    const shell = document.createElement("div");
    setStyles(shell, {
      display: "flex",
      flexDirection: "column",
      gap: "12px",
      padding: "4px 4px 10px",
      minWidth: "0"
    });

    const title = document.createElement("div");
    title.textContent = "设置";
    setStyles(title, {
      padding: "4px 10px 0",
      fontSize: "14px",
      fontWeight: "700",
      color: theme.accent
    });

    const helper = document.createElement("div");
    helper.textContent = "设置主题色、AI接口和整理偏好";
    setStyles(helper, {
      padding: "0 10px",
      fontSize: "12px",
      color: t.muted
    });

    const themeRow = createThemePicker(t, theme, async (newColor, newMode) => {
      if (newColor !== undefined) {
        await chrome.storage.local.set({ themeColor: newColor });
      }
      if (newMode !== undefined) {
        await chrome.storage.local.set({ themeMode: newMode });
      }
      await reloadTheme();
      applyThemeToPanel();
    });

    const status = document.createElement("div");
    setStyles(status, {
      padding: "0 10px",
      fontSize: "12px",
      color: t.muted,
      minHeight: "18px"
    });

    const fields = [
      createSettingsField("接口地址", "url", "https://api.openai.com/v1/chat/completions", t),
      createSettingsField("API Key", "password", "sk-...", t),
      createSettingsField("模型名", "text", "gpt-4.1-mini", t)
    ];
    const preferenceField = createSettingsTextarea("整理偏好", "例如：工作相关靠前，阅读类折叠，娱乐类靠后。", t);
    const toggleField = createSettingsToggle("实验功能：整理后简化网页标题", "整理后尝试为可注入网页写入更短的临时标题。", t, theme.accent);

    const actionRow = document.createElement("div");
    setStyles(actionRow, {
      display: "flex",
      gap: "8px",
      padding: "4px 10px 0",
      flexWrap: "wrap"
    });

    const saveButton = createToolbarButton("保存设置", async () => {
      status.textContent = "正在保存…";
      await saveInlineSettings({
        endpoint: fields[0].input.value,
        apiKey: fields[1].input.value,
        model: fields[2].input.value,
        preference: preferenceField.input.value,
        experimentalTitleRewriteEnabled: toggleField.input.checked
      });
      status.textContent = "已保存";
    }, t);

    const runButton = createToolbarButton("保存并立即整理标签页", async () => {
      status.textContent = "保存并开始整理…";
      await saveInlineSettings({
        endpoint: fields[0].input.value,
        apiKey: fields[1].input.value,
        model: fields[2].input.value,
        preference: preferenceField.input.value,
        experimentalTitleRewriteEnabled: toggleField.input.checked
      });
      const response = await chrome.runtime.sendMessage({ type: "run-ai-organization" });
      status.textContent = response?.summary || response?.reason || (response?.ok ? "已开始" : response?.error || "整理失败");
      if (response?.ok || response?.skipped) {
        close();
      }
    }, t);

    actionRow.appendChild(saveButton);
    actionRow.appendChild(runButton);

    shell.appendChild(title);
    shell.appendChild(helper);
    shell.appendChild(themeRow);
    fields.forEach((field) => shell.appendChild(field.wrapper));
    shell.appendChild(preferenceField.wrapper);
    shell.appendChild(toggleField.wrapper);
    shell.appendChild(actionRow);
    shell.appendChild(status);
    list.appendChild(shell);

    loadInlineSettings()
      .then((settings) => {
        fields[0].input.value = settings.endpoint;
        fields[1].input.value = settings.apiKey;
        fields[2].input.value = settings.model;
        preferenceField.input.value = settings.preference;
        toggleField.input.checked = settings.experimentalTitleRewriteEnabled;
      })
      .catch((error) => {
        status.textContent = error instanceof Error ? error.message : "读取设置失败";
      });
  }

  function createRow(entry, index) {
    const item = document.createElement("div");
    setStyles(item, {
      position: "relative",
      display: "block",
      flex: "0 0 auto",
      width: "100%",
      maxWidth: "100%",
      minWidth: "0",
      padding: "12px 14px",
      borderRadius: "18px",
      cursor: "pointer",
      overflow: "hidden",
      overflowX: "hidden",
      textAlign: "left",
      fontFamily: UI_FONT_FAMILY,
      userSelect: "none"
    });

    const left = document.createElement("div");
    setStyles(left, {
      display: "flex",
      alignItems: "center",
      gap: "12px",
      minWidth: "0",
      maxWidth: "100%",
      overflow: "hidden",
      paddingRight: "0"
    });

    const icon = document.createElement("div");
    setStyles(icon, {
      width: "18px",
      height: "18px",
      borderRadius: "6px",
      flex: "0 0 auto",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: (entry.kind === "command" || entry.kind === "url") ? t.commandBg : t.subtleBg,
      backgroundImage: entry.kind === "tab" && entry.favIconUrl ? `url("${entry.favIconUrl}")` : "",
      backgroundSize: "cover",
      backgroundPosition: "center",
      color: t.commandText
    });
    if (entry.kind === "url") {
      const urlSvg = entry.isSearch
        ? '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>'
        : '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>';
      icon.innerHTML = urlSvg;
    }
    if (entry.kind === "command") {
      const COMMAND_ICONS = {
        "settings": '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
        "arrange": '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 4V2"/><path d="M15 16v-2"/><path d="M8 9h2"/><path d="M20 9h2"/><path d="M17.8 11.8 19 13"/><path d="M15 9h.01"/><path d="M17.8 6.2 19 5"/><path d="m3 21 9-9"/><path d="M12.2 6.2 11 5"/></svg>',
        "natural-search": '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>'
      };
      icon.innerHTML = COMMAND_ICONS[entry.command] || "";
    }

    const meta = document.createElement("div");
    setStyles(meta, {
      display: "flex",
      flexDirection: "column",
      minWidth: "0",
      maxWidth: "100%",
      flex: "1 1 auto",
      overflow: "hidden"
    });

    const title = document.createElement("div");
    title.textContent = entry.title;
    setStyles(title, {
      fontSize: "14px",
      fontWeight: "600",
      color: entry.kind === "command" ? t.commandText : t.text,
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
      fontFamily: UI_FONT_FAMILY
    });

    const subtitleRow = document.createElement("div");
    setStyles(subtitleRow, {
      display: "flex",
      alignItems: "center",
      gap: "8px",
      marginTop: "2px",
      minWidth: "0",
      overflow: "hidden"
    });

    const subtitle = document.createElement("div");
    subtitle.textContent = entry.subtitle;
    setStyles(subtitle, {
      fontSize: "12px",
      color: entry.kind === "command" ? t.commandMuted : t.muted,
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
      fontFamily: UI_FONT_FAMILY,
      flex: "1 1 auto",
      minWidth: "0"
    });

    subtitleRow.appendChild(subtitle);

    const lastAccessedLabel = entry.kind === "tab" ? formatLastAccessed(entry.lastAccessed) : null;
    if (lastAccessedLabel) {
      const accessBadge = document.createElement("div");
      accessBadge.textContent = lastAccessedLabel;
      setStyles(accessBadge, {
        fontSize: "11px",
        color: t.muted,
        whiteSpace: "nowrap",
        flex: "0 0 auto",
        opacity: "0.75",
        fontFamily: UI_FONT_FAMILY
      });
      subtitleRow.appendChild(accessBadge);
    }

    meta.appendChild(title);
    meta.appendChild(subtitleRow);
    left.appendChild(icon);
    left.appendChild(meta);
    item.appendChild(left);

    const actions = supportsActions(entry) ? createActionsBar(entry) : null;

    if (actions) {
      item.appendChild(actions.container);
    }

    item.addEventListener("mouseenter", () => {
      hoveredIndex = index;
      selectedIndex = index;
      selectedAction = null;
      updateInteractiveState();
    });

    item.addEventListener("click", async () => {
      selectedIndex = index;
      hoveredIndex = index;
      await executeEntryAction(entry, defaultActionForEntry(entry));
    });

    return { item, entry, left, actions };
  }

  function createActionsBar(entry) {
    const container = document.createElement("div");
    setStyles(container, {
      position: "absolute",
      top: "50%",
      right: "14px",
      transform: "translateY(-50%)",
      display: "flex",
      justifyContent: "flex-end",
      gap: "8px",
      minWidth: "0",
      maxWidth: "calc(100% - 28px)",
      opacity: "0",
      pointerEvents: "none",
      transition: "opacity 120ms ease",
      overflow: "hidden",
      whiteSpace: "nowrap"
    });

    const buttons = {
      open: createActionButton("打开", async (event) => {
        event.stopPropagation();
        await executeEntryAction(entry, "open");
      }, t),
      close: createActionButton("关闭", async (event) => {
        event.stopPropagation();
        await executeEntryAction(entry, "close");
      }, t),
      bookmark_close: createActionButton("收藏后关闭", async (event) => {
        event.stopPropagation();
        await executeEntryAction(entry, "bookmark_close");
      }, t)
    };

    container.appendChild(buttons.open);
    container.appendChild(buttons.close);
    container.appendChild(buttons.bookmark_close);

    return { container, buttons };
  }

  function applyThemeToPanel() {
    overlay.style.background = t.overlayBg;
    panel.style.background = t.surface;
    panel.style.borderColor = t.border;
    input.style.color = t.text;
    clearButton.style.background = t.subtleBg;
    clearButton.style.color = t.muted;
    footer.style.background = t.surface;
    footer.style.borderTopColor = t.border;
    updateInteractiveState();
  }

  function updateInteractiveState() {
    headerButtons.forEach((button, index) => {
      const selected = headerFocusIndex === index;
      button.dataset.selected = selected ? "true" : "false";
      button.style.background = selected ? theme.accent : t.subtleBg;
      button.style.color = selected ? "#fff" : t.commandText;
    });

    rowNodes.forEach((row, index) => {
      const isKeyboardSelected = index === selectedIndex;
      const isHovered = index === hoveredIndex;
      const { entry, item, left, actions } = row;
      const isCommand = entry.kind === "command";
      const isUrl = entry.kind === "url";

      item.style.background = isKeyboardSelected
        ? t.selectedBg
        : isHovered
          ? t.subtleBg
          : isCommand
            ? t.commandBg
            : "transparent";
      item.style.boxShadow = isUrl ? `inset 0 0 0 1px ${t.urlShadow}` : "none";

      if (actions) {
        const showActions = isHovered || isKeyboardSelected;
        actions.container.style.opacity = showActions ? "1" : "0";
        actions.container.style.pointerEvents = showActions ? "auto" : "none";
        left.style.paddingRight = showActions ? "272px" : "0";
        updateActionSelection(actions.buttons, isKeyboardSelected ? selectedAction : null, theme.accent, t);
      }

      if (isKeyboardSelected) {
        item.scrollIntoView({ block: "nearest" });
      }
    });

    footerButtons.forEach((button, index) => {
      const selected = footerFocusIndex === index;
      button.dataset.selected = selected ? "true" : "false";
      button.style.background = selected ? theme.accent : t.subtleBg;
      button.style.color = selected ? "#ffffff" : t.commandText;

      if (selected) {
        button.scrollIntoView({ block: "nearest", inline: "nearest" });
      }
    });
  }

  async function executeEntryAction(entry, action) {
    if (entry.kind === "command" && entry.command === "arrange") {
      await chrome.runtime.sendMessage({ type: "run-ai-organization" });
      close();
      return;
    }

    if (entry.kind === "command" && entry.command === "natural-search") {
      await enterNaturalSearch();
      return;
    }

    if (entry.kind === "command" && entry.command === "settings") {
      await enterSettingsView();
      return;
    }

    if (entry.kind === "url") {
      const response = await chrome.runtime.sendMessage({ type: "open-url", url: entry.url });

      if (!response?.ok) {
        return;
      }

      close();
      return;
    }

    if (entry.kind !== "tab") {
      return;
    }

    if (action === "close") {
      const response = await chrome.runtime.sendMessage({ type: "close-tab", tabId: entry.tabId });
      if (!response?.ok) return;
      tabs = tabs.filter((tab) => tab.id !== entry.tabId);
      hoveredIndex = null;
      selectedAction = null;
      rebuildRows();
      return;
    }

    if (action === "bookmark_close") {
      const response = await chrome.runtime.sendMessage({ type: "bookmark-and-close-tab", tabId: entry.tabId });
      if (!response?.ok) return;
      tabs = tabs.filter((tab) => tab.id !== entry.tabId);
      hoveredIndex = null;
      selectedAction = null;
      rebuildRows();
      return;
    }

    await chrome.runtime.sendMessage({ type: "activate-tab", tabId: entry.tabId });
    close();
  }

  async function enterNaturalSearch() {
    const query = input.value.trim();

    if (!query) {
      return;
    }

    isNaturalLoading = true;
    searchMode = "natural";
    naturalPreview = null;
    headerFocusIndex = -1;
    footerFocusIndex = -1;
    selectedIndex = -1;
    selectedAction = null;
    hoveredIndex = null;
    rebuildRows();

    const response = await chrome.runtime.sendMessage({ type: "preview-batch-tabs", query });
    isNaturalLoading = false;

    if (!response?.ok) {
      searchMode = "default";
      rebuildRows();
      return;
    }

    naturalPreview = response.preview;
    headerFocusIndex = -1;
    footerFocusIndex = -1;
    selectedIndex = -1;
    selectedAction = null;
    hoveredIndex = null;
    rebuildRows();
  }

  function renderFooter() {
    footer.textContent = "";
    footerButtons = [];

    if (!hasNaturalBatchActions()) {
      footer.style.display = "none";
      list.style.paddingBottom = "10px";
      return;
    }

    footer.style.display = "flex";
    list.style.paddingBottom = "80px";

    NATURAL_BATCH_ACTIONS.forEach((definition, index) => {
      const button = createToolbarButton(definition.label, async () => {
        footerFocusIndex = index;
        updateInteractiveState();
        await executeNaturalBatchAction(definition.action);
      }, t);

      button.addEventListener("mouseenter", () => {
        headerFocusIndex = -1;
        selectedIndex = -1;
        selectedAction = null;
        hoveredIndex = null;
        footerFocusIndex = index;
        updateInteractiveState();
      });

      footerButtons.push(button);
      footer.appendChild(button);
    });
  }

  function hasNaturalBatchActions() {
    return searchMode === "natural" && !isNaturalLoading && (naturalPreview?.tabs || []).length > 0;
  }

  async function executeNaturalBatchAction(action) {
    if (!hasNaturalBatchActions() || !action) {
      return;
    }

    const response = await chrome.runtime.sendMessage({
      type: "apply-batch-action",
      action,
      tabIds: (naturalPreview?.tabs || []).map((tab) => tab.id),
      query: naturalPreview?.query || input.value.trim(),
      label: naturalPreview?.suggestedLabel || ""
    });

    if (!response?.ok) return;

    close();
  }

  rebuildRows();
  input.focus();
}

ensureSpinnerStyle();

function createActionButton(label, onClick, tokens) {
  const fg = (tokens && tokens.commandText) || "#1d4ed8";
  const bg = (tokens && tokens.subtleBg) || "rgba(15, 23, 42, 0.08)";
  const hoverBg = (tokens && tokens.hoverBg) || "rgba(15, 23, 42, 0.14)";
  const button = document.createElement("button");
  button.type = "button";
  const icon = BUTTON_ICONS[label] || "";
  button.innerHTML = icon + `<span>${label}</span>`;
  setStyles(button, {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "5px",
    border: "0",
    borderRadius: "10px",
    padding: "7px 10px",
    fontSize: "12px",
    fontWeight: "700",
    lineHeight: "1.2",
    cursor: "pointer",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    fontFamily: UI_FONT_FAMILY,
    color: fg,
    background: bg,
    flex: "0 0 auto"
  });
  button.addEventListener("mouseenter", () => {
    if (button.dataset.selected !== "true") {
      button.style.background = hoverBg;
    }
  });
  button.addEventListener("mouseleave", () => {
    if (button.dataset.selected !== "true") {
      button.style.background = bg;
    }
  });
  button.addEventListener("click", onClick);
  return button;
}

function createToolbarButton(label, onClick, tokens) {
  const fg = (tokens && tokens.commandText) || "#1d4ed8";
  const bg = (tokens && tokens.subtleBg) || "rgba(15, 23, 42, 0.08)";
  const hoverBg = (tokens && tokens.hoverBg) || "rgba(15, 23, 42, 0.14)";
  const button = document.createElement("button");
  button.type = "button";
  const icon = BUTTON_ICONS[label] || "";
  button.innerHTML = icon + `<span>${label}</span>`;
  button.dataset.label = label;
  setStyles(button, {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "5px",
    border: "0",
    borderRadius: "999px",
    cornerShape: "superellipse(2.1)",
    padding: "10px 12px",
    fontSize: "13px",
    fontWeight: "700",
    lineHeight: "1.2",
    cursor: "pointer",
    whiteSpace: "nowrap",
    fontFamily: UI_FONT_FAMILY,
    color: fg,
    background: bg,
    flex: "0 0 auto"
  });
  button.addEventListener("mouseenter", () => {
    if (button.dataset.selected !== "true") {
      button.style.background = hoverBg;
    }
  });
  button.addEventListener("mouseleave", () => {
    if (button.dataset.selected !== "true") {
      button.style.background = bg;
    }
  });
  button.addEventListener("click", onClick);
  return button;
}

function setToolbarButtonBusy(button, busy, busyLabel) {
  button.disabled = busy;
  const displayLabel = busy ? busyLabel : button.dataset.label || "";
  const icon = BUTTON_ICONS[button.dataset.label] || "";
  button.innerHTML = icon + `<span>${displayLabel}</span>`;
  button.style.opacity = busy ? "0.72" : "1";
  button.style.cursor = busy ? "default" : "pointer";
}

function updateActionSelection(buttons, selectedAction, accent, tokens) {
  const bg = (tokens && tokens.subtleBg) || "rgba(15, 23, 42, 0.08)";
  const fg = (tokens && tokens.commandText) || "#1d4ed8";
  const ac = accent || "#2563eb";
  Object.entries(buttons).forEach(([action, button]) => {
    const isSelected = selectedAction === action;
    button.dataset.selected = isSelected ? "true" : "false";
    button.style.color = isSelected ? "#fff" : fg;
    button.style.background = isSelected ? ac : bg;
  });
}

function buildEntries(tabs, query) {
  const entries = [];
  const trimmed = query.trim();
  const normalized = trimmed.toLowerCase();
  const settingsMatched = isSettingsCommand(trimmed, normalized);

  if (settingsMatched) {
    entries.push({
      id: "command-settings",
      kind: "command",
      command: "settings",
      title: "设置",
      subtitle: "设置主题色、AI接口和整理偏好"
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
      title: "整理标签页",
      subtitle: "智能整理并分组所有标签页"
    });
  }

  const matchingTabs = filterTabs(tabs, trimmed).map((tab) => ({
    id: `tab-${tab.id}`,
    kind: "tab",
    tabId: tab.id,
    title: tab.title,
    subtitle: tab.url,
    favIconUrl: tab.favIconUrl || "",
    lastAccessed: tab.lastAccessed || null
  }));

  entries.push(...matchingTabs);

  const fallbackTarget = matchingTabs.length === 0 && trimmed ? buildFallbackTarget(trimmed) : null;

  if (fallbackTarget) {
    entries.push({
      id: `fallback-${fallbackTarget.value}`,
      kind: "url",
      url: fallbackTarget.value,
      title: fallbackTarget.title,
      subtitle: fallbackTarget.subtitle,
      isSearch: fallbackTarget.title === "搜索"
    });
  }

  if (shouldShowNaturalSearchCommand(trimmed, normalized)) {
    const naturalEntry = {
      id: `natural-${trimmed}`,
      kind: "command",
      command: "natural-search",
      title: "自然语言智能搜索",
      subtitle: "“所有谷歌文档”、“3天没打开过的标签”"
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

function formatLastAccessed(lastAccessed) {
  if (!lastAccessed) return null;
  const minutes = Math.floor((Date.now() - lastAccessed) / 60000);
  if (minutes < 1) return "刚刚访问";
  if (minutes < 60) return `${minutes} 分钟前访问`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前访问`;
  const days = Math.floor(hours / 24);
  return `${days} 天前访问`;
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

  if (entries.length === 0) {
    return 0;
  }

  return Math.max(0, Math.min(index, entries.length - 1));
}

function cycleAction(currentAction, direction) {
  if (!currentAction) {
    return direction === "backward" ? ACTIONS[ACTIONS.length - 1] : ACTIONS[0];
  }

  const currentIndex = ACTIONS.indexOf(currentAction);

  if (currentIndex === -1) {
    return ACTIONS[0];
  }

  if (direction === "backward") {
    return ACTIONS[(currentIndex - 1 + ACTIONS.length) % ACTIONS.length];
  }

  return ACTIONS[(currentIndex + 1) % ACTIONS.length];
}

function shouldShowNaturalSearchCommand(query, normalizedQuery) {
  if (!query || normalizedQuery === "arrange") {
    return false;
  }

  return getNaturalSearchScore(query) >= 4;
}

function getNaturalSearchScore(value) {
  return Array.from(value).reduce((total, char) => total + (/[\u3400-\u9fff]/u.test(char) ? 2 : 1), 0);
}

function isSettingsCommand(query, normalizedQuery) {
  return (
    query.includes("设置") ||
    normalizedQuery.startsWith("set") ||
    normalizedQuery.includes("settings") ||
    normalizedQuery.includes("setting")
  );
}

function isCaretAtEnd(input) {
  return input.selectionStart === input.selectionEnd && input.selectionEnd === input.value.length;
}

function createSettingsField(label, type, placeholder, tokens) {
  const fg = (tokens && tokens.text) || "#0f172a";
  const inputBg = (tokens && tokens.inputBg) || "rgba(255, 255, 255, 0.42)";
  const borderC = (tokens && tokens.border) || "rgba(15, 23, 42, 0.10)";
  const settingsInputBg = inputBg.replace(/[\d.]+\)$/, "0.42)");
  const settingsBorderC = borderC.replace(/[\d.]+\)$/, "0.10)");
  const wrapper = document.createElement("label");
  setStyles(wrapper, {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    padding: "0 10px",
    fontSize: "12px",
    color: fg
  });

  const text = document.createElement("span");
  text.textContent = label;
  setStyles(text, { fontWeight: "700" });

  const input = document.createElement("input");
  input.type = type;
  input.placeholder = placeholder;
  setStyles(input, {
    width: "100%",
    border: `1px solid ${settingsBorderC}`,
    borderRadius: "12px",
    padding: "10px 12px",
    outline: "none",
    background: settingsInputBg,
    color: fg,
    fontSize: "13px"
  });

  wrapper.appendChild(text);
  wrapper.appendChild(input);
  return { wrapper, input };
}

function createSettingsTextarea(label, placeholder, tokens) {
  const fg = (tokens && tokens.text) || "#0f172a";
  const inputBg = (tokens && tokens.inputBg) || "rgba(255, 255, 255, 0.42)";
  const borderC = (tokens && tokens.border) || "rgba(15, 23, 42, 0.10)";
  const settingsInputBg = inputBg.replace(/[\d.]+\)$/, "0.42)");
  const settingsBorderC = borderC.replace(/[\d.]+\)$/, "0.10)");
  const wrapper = document.createElement("label");
  setStyles(wrapper, {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    padding: "0 10px",
    fontSize: "12px",
    color: fg
  });

  const text = document.createElement("span");
  text.textContent = label;
  setStyles(text, { fontWeight: "700" });

  const input = document.createElement("textarea");
  input.rows = 4;
  input.placeholder = placeholder;
  setStyles(input, {
    width: "100%",
    border: `1px solid ${settingsBorderC}`,
    borderRadius: "12px",
    padding: "10px 12px",
    outline: "none",
    background: settingsInputBg,
    color: fg,
    fontSize: "13px",
    resize: "vertical"
  });

  wrapper.appendChild(text);
  wrapper.appendChild(input);
  return { wrapper, input };
}

function createSettingsToggle(label, helper, tokens, accentColor) {
  const fg = (tokens && tokens.text) || "#0f172a";
  const mutedC = (tokens && tokens.muted) || "rgba(15, 23, 42, 0.62)";
  const wrapper = document.createElement("label");
  setStyles(wrapper, {
    display: "flex",
    alignItems: "flex-start",
    gap: "10px",
    padding: "4px 10px 0"
  });

  const input = document.createElement("input");
  input.type = "checkbox";
  setStyles(input, {
    marginTop: "2px",
    accentColor: accentColor || "auto"
  });

  const content = document.createElement("div");
  setStyles(content, {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    minWidth: "0"
  });

  const title = document.createElement("div");
  title.textContent = label;
  setStyles(title, {
    fontSize: "13px",
    fontWeight: "600",
    color: fg
  });

  const sub = document.createElement("div");
  sub.textContent = helper;
  setStyles(sub, {
    fontSize: "12px",
    color: mutedC
  });

  content.appendChild(title);
  content.appendChild(sub);
  wrapper.appendChild(input);
  wrapper.appendChild(content);
  return { wrapper, input };
}

function createThemePicker(tokens, currentTheme, onChange) {
  const fg = (tokens && tokens.text) || "#0f172a";
  const bg = (tokens && tokens.subtleBg) || "rgba(15, 23, 42, 0.08)";
  const borderC = (tokens && tokens.border) || "rgba(15, 23, 42, 0.12)";

  const row = document.createElement("div");
  setStyles(row, {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    padding: "6px 10px",
    marginBottom: "4px"
  });

  const swatchRow = document.createElement("div");
  setStyles(swatchRow, { display: "flex", gap: "8px" });

  THEME_SWATCH_COLORS.forEach((swatch) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.title = swatch.label;
    setStyles(btn, {
      width: "28px",
      height: "28px",
      borderRadius: "50%",
      border: swatch.key === currentTheme.color ? `2px solid ${fg}` : "2px solid transparent",
      background: swatch.bg,
      cursor: "pointer",
      padding: "0",
      outline: "none",
      transition: "border-color 120ms ease, transform 120ms ease"
    });
    btn.addEventListener("mouseenter", () => { btn.style.transform = "scale(1.12)"; });
    btn.addEventListener("mouseleave", () => { btn.style.transform = "scale(1)"; });
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      onChange(swatch.key, undefined);
      swatchRow.querySelectorAll("button").forEach((b) => { b.style.borderColor = "transparent"; });
      btn.style.borderColor = fg;
    });
    swatchRow.appendChild(btn);
  });

  const modeBtn = document.createElement("button");
  modeBtn.type = "button";
  modeBtn.title = "切换深浅色";
  modeBtn.dataset.mode = currentTheme.mode;
  modeBtn.innerHTML = `
    <span style="position:absolute;inset:0;display:flex;align-items:center;justify-content:space-between;padding:0 6px;pointer-events:none;color:${tokens.muted}">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
    </span>
    <span style="position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:${tokens.inputBg};box-shadow:0 1px 3px rgba(0,0,0,0.18);transition:transform 180ms ease;pointer-events:none;display:flex;align-items:center;justify-content:center;color:${currentTheme.accent};transform:${currentTheme.mode === "dark" ? "translateX(28px)" : "none"}">
      ${currentTheme.mode === "dark"
      ? '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>'
      : '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>'}
    </span>
  `;
  setStyles(modeBtn, {
    position: "relative",
    display: "inline-flex",
    alignItems: "center",
    width: "56px",
    height: "28px",
    padding: "0",
    border: `1px solid ${borderC}`,
    borderRadius: "999px",
    background: bg,
    cursor: "pointer",
    flexShrink: "0"
  });
  modeBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    const next = currentTheme.mode === "dark" ? "light" : "dark";
    currentTheme.mode = next;
    modeBtn.dataset.mode = next;
    const thumb = modeBtn.querySelector("span:last-child");
    if (thumb) {
      thumb.style.transform = next === "dark" ? "translateX(28px)" : "none";
      thumb.style.color = currentTheme.accent;
      thumb.innerHTML = next === "dark"
        ? '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>'
        : '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>';
    }
    onChange(undefined, next);
  });

  row.appendChild(swatchRow);
  row.appendChild(modeBtn);
  return row;
}

async function loadInlineSettings() {
  const stored = await chrome.storage.local.get([
    "aiEndpoint",
    "aiApiKey",
    "aiModel",
    "aiPreference",
    "experimentalTitleRewriteEnabled"
  ]);

  return {
    endpoint: normalizeSettingsEndpoint(stored.aiEndpoint || "https://api.openai.com/v1/chat/completions"),
    apiKey: stored.aiApiKey || "",
    model: stored.aiModel || "gpt-4.1-mini",
    preference: stored.aiPreference || "",
    experimentalTitleRewriteEnabled: Boolean(stored.experimentalTitleRewriteEnabled)
  };
}

async function saveInlineSettings(settings) {
  const endpoint = normalizeSettingsEndpoint(settings.endpoint);

  await chrome.storage.local.set({
    aiEndpoint: endpoint,
    aiApiKey: String(settings.apiKey || "").trim(),
    aiModel: String(settings.model || "").trim(),
    aiPreference: String(settings.preference || "").trim(),
    experimentalTitleRewriteEnabled: Boolean(settings.experimentalTitleRewriteEnabled)
  });
}

function normalizeSettingsEndpoint(endpoint) {
  const value = String(endpoint || "").trim();

  if (!value) {
    return "https://api.openai.com/v1/chat/completions";
  }

  try {
    const url = new URL(value);

    if (url.pathname === "/" || url.pathname === "" || url.pathname === "/v1" || url.pathname === "/v1/") {
      url.pathname = "/v1/chat/completions";
    }

    return url.toString();
  } catch (_error) {
    return value;
  }
}

function ensureSpinnerStyle() {
  if (document.getElementById("__ai_tab_organizer_spinner_style__")) {
    return;
  }

  const style = document.createElement("style");
  style.id = "__ai_tab_organizer_spinner_style__";
  style.textContent = [
    `@font-face { font-family: "Inter"; src: url("${chrome.runtime.getURL("inter.ttf")}") format("truetype"); font-weight: 100 900; font-style: normal; }`,
    "@keyframes ai-tab-organizer-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }",
    `#${OVERLAY_ID} ::-webkit-scrollbar { width: 4px !important; height: 4px !important; }`,
    `#${OVERLAY_ID} ::-webkit-scrollbar-track { background: transparent !important; }`,
    `#${OVERLAY_ID} ::-webkit-scrollbar-thumb { background: rgba(120,120,120,0.3) !important; border-radius: 999px !important; }`,
    `#${OVERLAY_ID} ::-webkit-scrollbar-thumb:hover { background: rgba(120,120,120,0.55) !important; }`
  ].join("\n");
  (document.head || document.documentElement).appendChild(style);
}

function filterTabs(tabs, query) {
  if (!query) {
    return tabs;
  }

  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);

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

function buildFallbackTarget(value) {
  const normalized = isLikelyUrl(value) ? normalizeUrl(value) : null;

  if (normalized) {
    return {
      value: normalized,
      title: "打开网址",
      subtitle: normalized
    };
  }

  return {
    value,
    title: "搜索",
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

function setStyles(node, styles) {
  Object.assign(
    node.style,
    {
      boxSizing: "border-box",
      fontFamily: UI_FONT_FAMILY
    },
    styles
  );
}
