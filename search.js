const {
  CUSTOM_AI_MODEL_OPTION_VALUE,
  applyAIProviderPreset,
  detectAIProviderPreset,
  populateAIModelSelect,
  populateAIProviderSelect,
  resolveAIModelSelection,
  updateAIKeyPlaceholder
} = globalThis.AIProviderConfig;
const i18n = globalThis.AITabI18n || {
  DEFAULT_UI_LANGUAGE: "cn",
  async getStoredLanguage() {
    return "cn";
  },
  getLocaleTag() {
    return "zh-CN";
  },
  t(_locale, key) {
    const fallback = {
      search: "Search",
      searchWindowTitle: "搜索标签页",
      searchWindowSubtitle: "当前页面不支持页内面板时，会自动打开这个独立搜索窗口。",
      searchInputPlaceholder: "通过关键词、网址、或一句话搜索标签",
      organizeTabs: "整理标签页",
      settings: "设置",
      popupRunBusy: "整理中…",
      naturalNoMatch: "自然语言搜索没有找到匹配标签页",
      noMatchedTabs: "没有匹配的标签页",
      naturalLoading: "正在进行自然语言搜索…",
      provider: "服务商",
      endpoint: "接口地址",
      modelName: "模型名",
      customModelPlaceholder: "输入自定义模型名",
      language: "语言",
      preference: "整理偏好",
      preferencePlaceholder: "例如：工作相关靠前，阅读类折叠，娱乐类靠后。",
      titleRewriteLabel: "实验功能：整理后简化网页标题",
      titleRewriteHelperShort: "整理后尝试为可注入网页写入更短的临时标题。",
      saveSettings: "保存设置",
      saveAndRun: "保存并立即整理",
      saving: "正在保存…",
      saved: "已保存",
      saveAndStart: "保存并开始整理…",
      started: "已开始",
      organizeFailed: "整理失败",
      loadSettingsFailed: "读取设置失败",
      open: "打开",
      close: "关闭",
      bookmarkAndClose: "收藏并关闭",
      closeAndAddToBookmarks: "关闭并加入收藏",
      closeMatchedTabs: "关闭搜索到的Tab",
      newGroup: "新建分组",
      settingsViewHint: "设置视图 · Esc 返回普通搜索",
      defaultHint: "方向键选择结果，左右方向键切换动作，回车确认"
    };
    return fallback[key] || key;
  },
  getLanguageOptions() {
    return [
      { value: "en", label: "English" },
      { value: "cn", label: "简体中文" },
      { value: "cn-t", label: "繁體中文" },
      { value: "jp", label: "日本語" },
      { value: "espanol", label: "Español" }
    ];
  }
};
const { loadInlineSettings, saveInlineSettings } = globalThis.AITabInlineSettings;
const {
  SEARCH_ACTIONS,
  buildEntries,
  buildNaturalEntries,
  cycleAction,
  defaultActionForEntry,
  normalizeIndex,
  supportsActions
} = globalThis.AITabSearchCore;

const ACTIONS = SEARCH_ACTIONS;
const UI_FONT_FAMILY = "sans-serif";

initialize();

async function initialize() {
  const root = document.getElementById("search-root");

  if (!root) {
    return;
  }

  const sourceWindowId = new URLSearchParams(window.location.search).get("sourceWindowId");
  const targetWindowId = sourceWindowId ? Number(sourceWindowId) : undefined;
  const currentLocale = await i18n.getStoredLanguage();
  const NATURAL_BATCH_ACTIONS = [
    { action: "bookmark_close", label: i18n.t(currentLocale, "closeAndAddToBookmarks") },
    { action: "delete", label: i18n.t(currentLocale, "closeMatchedTabs") },
    { action: "group", label: i18n.t(currentLocale, "newGroup") }
  ];
  document.documentElement.lang = i18n.getLocaleTag(currentLocale);
  const eyebrow = document.getElementById("search-window-eyebrow");
  const titleNode = document.getElementById("search-window-title");
  const subtitleNode = document.getElementById("search-window-subtitle");

  if (eyebrow) {
    eyebrow.textContent = i18n.t(currentLocale, "search");
  }
  if (titleNode) {
    titleNode.textContent = i18n.t(currentLocale, "searchWindowTitle");
  }
  if (subtitleNode) {
    subtitleNode.textContent = i18n.t(currentLocale, "searchWindowSubtitle");
  }

  const response = await chrome.runtime.sendMessage({ type: "get-tabs" });

  if (!response?.ok) {
    root.textContent = response?.error || i18n.t(currentLocale, "organizeFailed");
    return;
  }

  let tabs = response.tabs || [];
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

  const shell = document.createElement("div");
  setStyles(shell, {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    fontFamily: UI_FONT_FAMILY
  });

  const toolbar = document.createElement("div");
  setStyles(toolbar, {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    minWidth: "0"
  });

  const input = document.createElement("input");
  input.type = "search";
  input.placeholder = i18n.t(currentLocale, "searchInputPlaceholder");
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
    border: "1px solid #dfdfda",
    outline: "none",
    background: "#fff",
    borderRadius: "44px",
    cornerShape: "superellipse(2.1)",
    padding: "12px 14px",
    fontSize: "18px",
    color: "#0f172a",
    fontFamily: UI_FONT_FAMILY
  });

  const arrangeLabel = i18n.t(currentLocale, "organizeTabs");
  const settingsLabel = i18n.t(currentLocale, "settings");

  const arrangeButton = createToolbarButton(arrangeLabel, async () => {
    setToolbarButtonBusy(arrangeButton, true, i18n.t(currentLocale, "popupRunBusy"));

    try {
      await chrome.runtime.sendMessage({ type: "run-ai-organization", windowId: targetWindowId });
      window.close();
    } finally {
      setToolbarButtonBusy(arrangeButton, false, arrangeLabel);
    }
  });

  const settingsButton = createToolbarButton(settingsLabel, async () => {
    await enterSettingsView();
  });

  const headerButtons = [arrangeButton, settingsButton];

  const hint = document.createElement("div");
  setStyles(hint, {
    color: "rgba(15, 23, 42, 0.56)",
    fontSize: "12px",
    fontFamily: UI_FONT_FAMILY
  });

  const list = document.createElement("div");
  setStyles(list, {
    flex: "1 1 auto",
    minHeight: "0",
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
    alignItems: "center",
    gap: "8px",
    minWidth: "0",
    overflowX: "auto",
    overflowY: "hidden"
  });

  toolbar.appendChild(input);
  toolbar.appendChild(arrangeButton);
  toolbar.appendChild(settingsButton);
  shell.appendChild(toolbar);
  shell.appendChild(hint);
  shell.appendChild(list);
  shell.appendChild(footer);
  root.appendChild(shell);

  list.addEventListener("mouseleave", () => {
    hoveredIndex = null;
    selectedIndex = -1;
    selectedAction = null;
    updateInteractiveState();
  });

  input.addEventListener("input", () => {
    searchMode = "default";
    naturalPreview = null;
    headerFocusIndex = -1;
    footerFocusIndex = -1;
    selectedIndex = -1;
    selectedAction = null;
    hoveredIndex = null;
    updateHint();
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

    if (event.key === "Escape" && (searchMode === "natural" || searchMode === "settings")) {
      searchMode = "default";
      naturalPreview = null;
      headerFocusIndex = -1;
      footerFocusIndex = -1;
      selectedIndex = -1;
      selectedAction = null;
      hoveredIndex = null;
      updateHint();
      rebuildRows();
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

    entries = searchMode === "natural" && naturalPreview ? buildNaturalEntries(naturalPreview) : buildEntries(tabs, input.value.trim(), currentLocale);
    selectedIndex = normalizeIndex(selectedIndex, entries);

    if (!supportsActions(entries[selectedIndex])) {
      selectedAction = null;
    }

    rowNodes = [];
    list.textContent = "";
    renderFooter();

    if (entries.length === 0) {
      const empty = document.createElement("div");
      empty.textContent = searchMode === "natural" ? i18n.t(currentLocale, "naturalNoMatch") : i18n.t(currentLocale, "noMatchedTabs");
      setStyles(empty, {
        padding: "12px 14px 16px",
        flex: "0 0 auto",
        color: "rgba(15, 23, 42, 0.6)",
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
      color: "rgba(15, 23, 42, 0.72)",
      fontSize: "13px",
      fontFamily: UI_FONT_FAMILY
    });

    const spinner = document.createElement("div");
    setStyles(spinner, {
      width: "16px",
      height: "16px",
      borderRadius: "999px",
      border: "2px solid rgba(15, 23, 42, 0.18)",
      borderTopColor: "#0f172a",
      flex: "0 0 auto",
      animation: "ai-tab-organizer-spin 0.7s linear infinite"
    });

    const label = document.createElement("div");
    label.textContent = i18n.t(currentLocale, "naturalLoading");

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
    updateHint();
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
      padding: "4px 0 10px",
      minWidth: "0"
    });

    const title = document.createElement("div");
    title.textContent = i18n.t(currentLocale, "settings");
    setStyles(title, {
      padding: "4px 10px 0",
      fontSize: "14px",
      fontWeight: "700",
      color: "#0f172a"
    });

    const helper = document.createElement("div");
    helper.textContent = i18n.t(currentLocale, "settingsHelperLong");
    setStyles(helper, {
      padding: "0 10px",
      fontSize: "12px",
      color: "rgba(15, 23, 42, 0.62)"
    });

    const status = document.createElement("div");
    setStyles(status, {
      padding: "0 10px",
      fontSize: "12px",
      color: "rgba(15, 23, 42, 0.72)",
      minHeight: "18px"
    });

    const providerField = createSettingsSelect(i18n.t(currentLocale, "provider"));
    populateAIProviderSelect(providerField.input, currentLocale);

    const endpointField = createSettingsField(i18n.t(currentLocale, "endpoint"), "url", "https://api.openai.com/v1/chat/completions");
    const apiKeyField = createSettingsField("API Key", "password", "sk-...");
    const modelField = createSettingsSelect(i18n.t(currentLocale, "modelName"));
    const customModelInput = createSettingsStandaloneInput("text", i18n.t(currentLocale, "customModelPlaceholder"));
    customModelInput.style.display = "none";
    modelField.wrapper.appendChild(customModelInput);
    const languageField = createSettingsSelect(i18n.t(currentLocale, "language"));
    i18n.getLanguageOptions().forEach((item) => {
      const option = document.createElement("option");
      option.value = item.value;
      option.textContent = item.label;
      languageField.input.appendChild(option);
    });
    const preferenceField = createSettingsTextarea(i18n.t(currentLocale, "preference"), i18n.t(currentLocale, "preferencePlaceholder"));
    const toggleField = createSettingsToggle(i18n.t(currentLocale, "titleRewriteLabel"), i18n.t(currentLocale, "titleRewriteHelperShort"));

    const actionRow = document.createElement("div");
    setStyles(actionRow, {
      display: "flex",
      gap: "8px",
      padding: "4px 10px 0",
      flexWrap: "wrap"
    });

    const saveButton = createToolbarButton(i18n.t(currentLocale, "saveSettings"), async () => {
      status.textContent = i18n.t(currentLocale, "saving");
      await saveInlineSettings({
        providerId: providerField.input.value,
        endpoint: endpointField.input.value,
        apiKey: apiKeyField.input.value,
        model: getCurrentModelValue(),
        preference: preferenceField.input.value,
        experimentalTitleRewriteEnabled: toggleField.input.checked,
        uiLanguage: languageField.input.value
      });
      status.textContent = i18n.t(currentLocale, "saved");
    });

    const runButton = createToolbarButton(i18n.t(currentLocale, "saveAndRun"), async () => {
      status.textContent = i18n.t(currentLocale, "saveAndStart");
      await saveInlineSettings({
        providerId: providerField.input.value,
        endpoint: endpointField.input.value,
        apiKey: apiKeyField.input.value,
        model: getCurrentModelValue(),
        preference: preferenceField.input.value,
        experimentalTitleRewriteEnabled: toggleField.input.checked,
        uiLanguage: languageField.input.value
      });
      const response = await chrome.runtime.sendMessage({ type: "run-ai-organization", windowId: targetWindowId });
      status.textContent = response?.summary || response?.reason || (response?.ok ? i18n.t(currentLocale, "started") : response?.error || i18n.t(currentLocale, "organizeFailed"));
      if (response?.ok || response?.skipped) {
        window.close();
      }
    });

    actionRow.appendChild(saveButton);
    actionRow.appendChild(runButton);

    shell.appendChild(title);
    shell.appendChild(helper);
    shell.appendChild(providerField.wrapper);
    shell.appendChild(endpointField.wrapper);
    shell.appendChild(apiKeyField.wrapper);
    shell.appendChild(modelField.wrapper);
    shell.appendChild(languageField.wrapper);
    shell.appendChild(preferenceField.wrapper);
    shell.appendChild(toggleField.wrapper);
    shell.appendChild(actionRow);
    shell.appendChild(status);
    list.appendChild(shell);

    providerField.input.addEventListener("change", () => {
      const nextDraft = applyAIProviderPreset(providerField.input.value, {
        endpoint: endpointField.input.value,
        apiKey: apiKeyField.input.value,
        model: getCurrentModelValue(),
        preference: preferenceField.input.value,
        experimentalTitleRewriteEnabled: toggleField.input.checked
      });

      endpointField.input.value = nextDraft.endpoint;
      syncModelControls(nextDraft.providerId, nextDraft.model);
      updateAIKeyPlaceholder(apiKeyField.input, nextDraft.providerId, languageField.input.value);
    });

    endpointField.input.addEventListener("input", () => {
      providerField.input.value = detectAIProviderPreset(endpointField.input.value);
      syncModelControls(providerField.input.value, getCurrentModelValue());
      updateAIKeyPlaceholder(apiKeyField.input, providerField.input.value, languageField.input.value);
    });

    modelField.input.addEventListener("change", () => {
      const isCustom = modelField.input.value === CUSTOM_AI_MODEL_OPTION_VALUE;

      if (isCustom && !customModelInput.value.trim()) {
        customModelInput.value = modelField.input.dataset.selectedPresetModel || "";
      }

      if (!isCustom) {
        modelField.input.dataset.selectedPresetModel = modelField.input.value;
      }

      customModelInput.style.display = isCustom ? "block" : "none";
    });

    loadInlineSettings()
      .then((settings) => {
        providerField.input.value = settings.providerId;
        endpointField.input.value = settings.endpoint;
        apiKeyField.input.value = settings.apiKey;
        syncModelControls(settings.providerId, settings.model);
        languageField.input.value = settings.uiLanguage || currentLocale;
        preferenceField.input.value = settings.preference;
        toggleField.input.checked = settings.experimentalTitleRewriteEnabled;
        updateAIKeyPlaceholder(apiKeyField.input, settings.providerId, languageField.input.value);
      })
      .catch((error) => {
        status.textContent = error instanceof Error ? error.message : i18n.t(currentLocale, "loadSettingsFailed");
      });

    function syncModelControls(providerId, modelValue) {
      const selection = resolveAIModelSelection(providerId, modelValue);
      populateAIModelSelect(modelField.input, providerId, modelValue, languageField.input.value);
      modelField.input.value = selection.selectedValue;
      modelField.input.dataset.selectedPresetModel =
        selection.selectedValue === CUSTOM_AI_MODEL_OPTION_VALUE ? selection.options[0]?.value || "" : selection.selectedValue;
      customModelInput.value = selection.customValue;
      customModelInput.style.display = selection.selectedValue === CUSTOM_AI_MODEL_OPTION_VALUE ? "block" : "none";
    }

    function getCurrentModelValue() {
      return modelField.input.value === CUSTOM_AI_MODEL_OPTION_VALUE ? customModelInput.value.trim() : modelField.input.value;
    }
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
      userSelect: "none",
      border: "1px solid #e7e7e2",
      background: "#fff"
    });

    const left = document.createElement("div");
    setStyles(left, {
      display: "flex",
      alignItems: "center",
      gap: "12px",
      minWidth: "0",
      maxWidth: "100%",
      overflow: "hidden",
      paddingRight: "0",
      transition: "padding-right 120ms ease"
    });

    const icon = document.createElement("div");
    setStyles(icon, {
      width: "18px",
      height: "18px",
      borderRadius: "6px",
      flex: "0 0 auto",
      background: entry.kind === "command" ? "rgba(37, 99, 235, 0.14)" : "rgba(15, 23, 42, 0.08)",
      backgroundImage: entry.kind === "tab" && entry.favIconUrl ? `url("${entry.favIconUrl}")` : "",
      backgroundSize: "cover",
      backgroundPosition: "center"
    });

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
      color: entry.kind === "command" ? "#1d4ed8" : "#0f172a",
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
      fontFamily: UI_FONT_FAMILY
    });

    const subtitle = document.createElement("div");
    subtitle.textContent = entry.subtitle;
    setStyles(subtitle, {
      marginTop: "2px",
      fontSize: "12px",
      color: entry.kind === "command" ? "rgba(29, 78, 216, 0.78)" : "rgba(15, 23, 42, 0.66)",
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
      fontFamily: UI_FONT_FAMILY
    });

    meta.appendChild(title);
    meta.appendChild(subtitle);
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
      open: createActionButton(i18n.t(currentLocale, "open"), async (event) => {
        event.stopPropagation();
        await executeEntryAction(entry, "open");
      }),
      close: createActionButton(i18n.t(currentLocale, "close"), async (event) => {
        event.stopPropagation();
        await executeEntryAction(entry, "close");
      }),
      bookmark_close: createActionButton(i18n.t(currentLocale, "bookmarkAndClose"), async (event) => {
        event.stopPropagation();
        await executeEntryAction(entry, "bookmark_close");
      })
    };

    container.appendChild(buttons.open);
    container.appendChild(buttons.close);
    container.appendChild(buttons.bookmark_close);

    return { container, buttons };
  }

  function updateInteractiveState() {
    headerButtons.forEach((button, index) => {
      const selected = headerFocusIndex === index;
      button.dataset.selected = selected ? "true" : "false";
      button.style.background = selected ? "#2563eb" : "rgba(15, 23, 42, 0.08)";
      button.style.color = selected ? "#fff" : "#0f172a";
    });

    rowNodes.forEach((row, index) => {
      const isKeyboardSelected = index === selectedIndex;
      const isHovered = index === hoveredIndex;
      const { entry, item, left, actions } = row;
      const isCommand = entry.kind === "command";
      const isUrl = entry.kind === "url";

      item.style.background = isKeyboardSelected
        ? "rgba(15, 23, 42, 0.10)"
        : isCommand
          ? "rgba(37, 99, 235, 0.06)"
          : "#ffffff";
      item.style.boxShadow = isUrl ? "inset 0 0 0 1px rgba(37, 99, 235, 0.10)" : "none";

      if (actions) {
        const showActions = isHovered || isKeyboardSelected;
        actions.container.style.opacity = showActions ? "1" : "0";
        actions.container.style.pointerEvents = showActions ? "auto" : "none";
        left.style.paddingRight = showActions ? "272px" : "0";
        updateActionSelection(actions.buttons, isKeyboardSelected ? selectedAction : null);
      }

      if (isKeyboardSelected) {
        item.scrollIntoView({ block: "nearest" });
      }
    });

    footerButtons.forEach((button, index) => {
      const selected = footerFocusIndex === index;
      button.dataset.selected = selected ? "true" : "false";
      button.style.background = selected ? "#2563eb" : "rgba(15, 23, 42, 0.08)";
      button.style.color = selected ? "#ffffff" : "#0f172a";

      if (selected) {
        button.scrollIntoView({ block: "nearest", inline: "nearest" });
      }
    });
  }

  async function executeEntryAction(entry, action) {
    if (entry.kind === "command" && entry.command === "arrange") {
      await chrome.runtime.sendMessage({ type: "run-ai-organization", windowId: targetWindowId });
      window.close();
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
        hint.textContent = response?.error || i18n.t(currentLocale, "organizeFailed");
        return;
      }

      window.close();
      return;
    }

    if (entry.kind !== "tab") {
      return;
    }

    if (action === "close") {
      const response = await chrome.runtime.sendMessage({ type: "close-tab", tabId: entry.tabId });
      if (!response?.ok) {
        hint.textContent = response?.error || i18n.t(currentLocale, "organizeFailed");
        return;
      }
      tabs = tabs.filter((tab) => tab.id !== entry.tabId);
      hoveredIndex = null;
      selectedAction = null;
      rebuildRows();
      return;
    }

    if (action === "bookmark_close") {
      const response = await chrome.runtime.sendMessage({ type: "bookmark-and-close-tab", tabId: entry.tabId });
      if (!response?.ok) {
        hint.textContent = response?.error || i18n.t(currentLocale, "organizeFailed");
        return;
      }
      tabs = tabs.filter((tab) => tab.id !== entry.tabId);
      hoveredIndex = null;
      selectedAction = null;
      rebuildRows();
      return;
    }

    await chrome.runtime.sendMessage({ type: "activate-tab", tabId: entry.tabId });
    window.close();
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
    updateHint();
    rebuildRows();

    const response = await chrome.runtime.sendMessage({ type: "preview-batch-tabs", query, windowId: targetWindowId });
    isNaturalLoading = false;

    if (!response?.ok) {
      searchMode = "default";
      hint.textContent = response?.error || i18n.t(currentLocale, "organizeFailed");
      rebuildRows();
      return;
    }

    naturalPreview = response.preview;
    headerFocusIndex = -1;
    footerFocusIndex = -1;
    selectedIndex = -1;
    selectedAction = null;
    hoveredIndex = null;
    updateHint();
    rebuildRows();
  }

  function updateHint() {
    if (isNaturalLoading) {
      hint.textContent = i18n.t(currentLocale, "naturalLoading");
      return;
    }

    if (searchMode === "natural") {
      hint.textContent = naturalPreview?.rationale
        ? `${naturalPreview.rationale} · Esc`
        : "Esc";
      return;
    }

    if (searchMode === "settings") {
      hint.textContent = i18n.t(currentLocale, "settingsViewHint");
      return;
    }

    hint.textContent = i18n.t(currentLocale, "defaultHint");
  }

  function renderFooter() {
    footer.textContent = "";
    footerButtons = [];

    if (!hasNaturalBatchActions()) {
      footer.style.display = "none";
      return;
    }

    footer.style.display = "flex";

    NATURAL_BATCH_ACTIONS.forEach((definition, index) => {
      const button = createToolbarButton(definition.label, async () => {
        footerFocusIndex = index;
        updateInteractiveState();
        await executeNaturalBatchAction(definition.action);
      });

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
      label: naturalPreview?.suggestedLabel || "",
      windowId: targetWindowId
    });

    if (!response?.ok) {
      hint.textContent = response?.error || i18n.t(currentLocale, "organizeFailed");
      return;
    }

    window.close();
  }

  rebuildRows();
  updateHint();
  input.focus();
}

ensureSpinnerStyle();

function createActionButton(label, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  setStyles(button, {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
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
    color: "#0f172a",
    background: "rgba(15, 23, 42, 0.08)",
    flex: "0 0 auto"
  });
  button.addEventListener("mouseenter", () => {
    if (button.dataset.selected !== "true") {
      button.style.background = "rgba(15, 23, 42, 0.14)";
    }
  });
  button.addEventListener("mouseleave", () => {
    if (button.dataset.selected !== "true") {
      button.style.background = "rgba(15, 23, 42, 0.08)";
    }
  });
  button.addEventListener("click", onClick);
  return button;
}

function createToolbarButton(label, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.dataset.label = label;
  setStyles(button, {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
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
    color: "#0f172a",
    background: "rgba(15, 23, 42, 0.08)",
    flex: "0 0 auto"
  });
  button.addEventListener("mouseenter", () => {
    if (button.dataset.selected !== "true") {
      button.style.background = "rgba(15, 23, 42, 0.14)";
    }
  });
  button.addEventListener("mouseleave", () => {
    if (button.dataset.selected !== "true") {
      button.style.background = "rgba(15, 23, 42, 0.08)";
    }
  });
  button.addEventListener("click", onClick);
  return button;
}

function setToolbarButtonBusy(button, busy, busyLabel) {
  button.disabled = busy;
  button.textContent = busy ? busyLabel : button.dataset.label || "";
  button.style.opacity = busy ? "0.72" : "1";
  button.style.cursor = busy ? "default" : "pointer";
}

function updateActionSelection(buttons, selectedAction) {
  Object.entries(buttons).forEach(([action, button]) => {
    const isSelected = selectedAction === action;
    button.dataset.selected = isSelected ? "true" : "false";
    button.style.color = isSelected ? "#fff" : "#0f172a";
    button.style.background = isSelected ? "#2563eb" : "rgba(15, 23, 42, 0.08)";
  });
}

function isCaretAtEnd(input) {
  return input.selectionStart === input.selectionEnd && input.selectionEnd === input.value.length;
}

function createSettingsField(label, type, placeholder) {
  const wrapper = document.createElement("label");
  setStyles(wrapper, {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    padding: "0 10px",
    fontSize: "12px",
    color: "#0f172a"
  });

  const text = document.createElement("span");
  text.textContent = label;

  const input = document.createElement("input");
  input.type = type;
  input.placeholder = placeholder;
  setStyles(input, {
    width: "100%",
    border: "1px solid rgba(15, 23, 42, 0.12)",
    borderRadius: "12px",
    padding: "10px 12px",
    paddingRight: "40px",
    outline: "none",
    background: "#ffffff",
    appearance: "none",
    WebkitAppearance: "none",
    backgroundImage:
      "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12' fill='none'%3E%3Cpath d='M2 4.5L6 8L10 4.5' stroke='%236d6d67' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")",
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right 14px center",
    backgroundSize: "12px 12px",
    color: "#0f172a",
    fontSize: "13px"
  });

  wrapper.appendChild(text);
  wrapper.appendChild(input);
  return { wrapper, input };
}

function createSettingsSelect(label) {
  const wrapper = document.createElement("label");
  setStyles(wrapper, {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    padding: "0 10px",
    fontSize: "12px",
    color: "#0f172a"
  });

  const text = document.createElement("span");
  text.textContent = label;

  const input = document.createElement("select");
  setStyles(input, {
    width: "100%",
    border: "1px solid rgba(15, 23, 42, 0.12)",
    borderRadius: "12px",
    padding: "10px 12px",
    outline: "none",
    background: "#ffffff",
    color: "#0f172a",
    fontSize: "13px"
  });

  wrapper.appendChild(text);
  wrapper.appendChild(input);
  return { wrapper, input };
}

function createSettingsStandaloneInput(type, placeholder) {
  const input = document.createElement("input");
  input.type = type;
  input.placeholder = placeholder;
  setStyles(input, {
    width: "100%",
    border: "1px solid rgba(15, 23, 42, 0.12)",
    borderRadius: "12px",
    padding: "10px 12px",
    outline: "none",
    background: "#ffffff",
    color: "#0f172a",
    fontSize: "13px"
  });
  return input;
}

function createSettingsTextarea(label, placeholder) {
  const wrapper = document.createElement("label");
  setStyles(wrapper, {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    padding: "0 10px",
    fontSize: "12px",
    color: "#0f172a"
  });

  const text = document.createElement("span");
  text.textContent = label;

  const input = document.createElement("textarea");
  input.rows = 4;
  input.placeholder = placeholder;
  setStyles(input, {
    width: "100%",
    border: "1px solid rgba(15, 23, 42, 0.12)",
    borderRadius: "12px",
    padding: "10px 12px",
    outline: "none",
    background: "#ffffff",
    color: "#0f172a",
    fontSize: "13px",
    resize: "vertical"
  });

  wrapper.appendChild(text);
  wrapper.appendChild(input);
  return { wrapper, input };
}

function createSettingsToggle(label, helper) {
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
    marginTop: "2px"
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
    color: "#0f172a"
  });

  const sub = document.createElement("div");
  sub.textContent = helper;
  setStyles(sub, {
    fontSize: "12px",
    color: "rgba(15, 23, 42, 0.62)"
  });

  content.appendChild(title);
  content.appendChild(sub);
  wrapper.appendChild(input);
  wrapper.appendChild(content);
  return { wrapper, input };
}

function ensureSpinnerStyle() {
  if (document.getElementById("__ai_tab_organizer_spinner_style__")) {
    return;
  }

  const style = document.createElement("style");
  style.id = "__ai_tab_organizer_spinner_style__";
  style.textContent = "@keyframes ai-tab-organizer-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }";
  (document.head || document.documentElement).appendChild(style);
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
