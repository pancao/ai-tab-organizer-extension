# Arc Tabs 代码导读

这份文档基于当前仓库代码编写，目标是让第一次接手这个扩展的人能在较短时间里看懂它怎么跑、主要逻辑放在哪、哪些地方值得格外留意。

## 1. 项目是什么

`Arc Tabs` 是一个不经过构建工具的 Chrome Manifest V3 扩展，核心能力有两块：

1. 用 AI 对当前窗口的标签页做重排和分组。
2. 提供两个搜索入口，既能按关键词找标签页，也能用自然语言挑出一批标签页，然后批量分组、关闭、收藏。

项目没有 `src/`、没有打包链路、也没有框架。所有逻辑都直接放在仓库根目录，浏览器按 `manifest.json` 直接加载。

## 2. 运行时架构

### 2.1 四个运行面

1. `background.js`
   这是服务端角色的核心。它负责命令入口、消息路由、AI 请求、方案校验、标签页分组、书签操作、标题简化等逻辑。
2. `popup.html` / `popup.js`
   这是扩展图标点开后的轻量弹窗，只提供三个动作入口：整理、搜索、打开设置。
3. `options.html` / `options.js`
   这是完整设置页，用来保存 AI 提供商、接口地址、模型、偏好、实验功能和主题。
4. `content.js` / `search.js`
   这是两个搜索界面。
   `content.js` 在普通网页里拉起页内浮层搜索面板。
   `search.js` 在无法注入页内浮层时，打开独立搜索窗口。

### 2.2 数据流总览

1. 用户从弹窗、快捷键、页内面板或独立搜索窗口发起动作。
2. 前端页面通过 `chrome.runtime.sendMessage` 把动作发给 `background.js`。
3. `background.js` 读取 `chrome.storage.local` 里的设置和标签页列表。
4. 需要 AI 时，`background.js` 直接请求兼容 OpenAI Chat Completions 的接口。
5. AI 返回 JSON 后，后台做一次本地校验和补全，再真正操作标签页或书签。
6. 弹窗通过轮询 `get-organization-state` 了解后台当前是否忙碌。

### 2.3 manifest 里的关键配置

[`manifest.json`](/Users/zhaolixing/GitHub/ai-tab-organizer-extension/manifest.json) 定义了几个关键点：

- `background.service_worker = background.js`
- `content_scripts` 会把 `ai-provider-config.js` 和 `content.js` 注入到所有网址
- `options_page = options.html`
- 注册了两个命令：
  - `search-tabs`
  - `organize-tabs-ai`
- 用到的权限包括 `tabs`、`tabGroups`、`storage`、`bookmarks`、`search`、`scripting`

## 3. 文件职责地图

| 文件 | 角色 |
| --- | --- |
| [`manifest.json`](/Users/zhaolixing/GitHub/ai-tab-organizer-extension/manifest.json) | 扩展入口、权限、命令、页面声明 |
| [`background.js`](/Users/zhaolixing/GitHub/ai-tab-organizer-extension/background.js) | 后台服务，统一处理业务动作 |
| [`content.js`](/Users/zhaolixing/GitHub/ai-tab-organizer-extension/content.js) | 普通网页内的浮层搜索面板 |
| [`search.js`](/Users/zhaolixing/GitHub/ai-tab-organizer-extension/search.js) | 独立搜索窗口逻辑 |
| [`popup.js`](/Users/zhaolixing/GitHub/ai-tab-organizer-extension/popup.js) | 扩展弹窗的三个入口按钮 |
| [`options.js`](/Users/zhaolixing/GitHub/ai-tab-organizer-extension/options.js) | 设置页逻辑 |
| [`ai-provider-config.js`](/Users/zhaolixing/GitHub/ai-tab-organizer-extension/ai-provider-config.js) | AI 服务商预置、接口地址归一化、模型下拉辅助 |
| [`theme.js`](/Users/zhaolixing/GitHub/ai-tab-organizer-extension/theme.js) | 在 popup / options / search 页面同步主题色和深浅模式 |
| [`ui.css`](/Users/zhaolixing/GitHub/ai-tab-organizer-extension/ui.css) | popup / options / standalone search 的共享样式 |
| [`tests/ai-provider-config.test.mjs`](/Users/zhaolixing/GitHub/ai-tab-organizer-extension/tests/ai-provider-config.test.mjs) | AI 提供商配置逻辑测试 |
| [`tests/options-page-scope.test.mjs`](/Users/zhaolixing/GitHub/ai-tab-organizer-extension/tests/options-page-scope.test.mjs) | 验证 `content.js` 和 `options.js` 在同一作用域下不会直接炸掉 |

## 4. 消息协议

项目的消息协议很集中，全部由 [`background.js`](/Users/zhaolixing/GitHub/ai-tab-organizer-extension/background.js) 的 `handleRuntimeMessage()` 统一处理。

| 消息类型 | 发起方 | 作用 |
| --- | --- | --- |
| `get-organization-state` | `popup.js` | 读取后台当前整理状态 |
| `run-ai-organization` | `popup.js` `options.js` `search.js` `content.js` | 对当前窗口或指定窗口执行 AI 整理 |
| `run-tab-search` | `popup.js` | 打开搜索面板 |
| `open-settings-page` | 预留 | 打开设置页 |
| `get-tabs` | `search.js` `content.js` | 获取可搜索标签页列表 |
| `activate-tab` | `search.js` `content.js` | 切到某个标签页 |
| `open-url` | `search.js` `content.js` | 直接打开网址或执行浏览器搜索 |
| `close-tab` | `search.js` `content.js` | 关闭单个标签页 |
| `bookmark-and-close-tab` | `search.js` `content.js` | 收藏后关闭单个标签页 |
| `preview-batch-tabs` | `search.js` `content.js` | 用自然语言先让 AI 选出一批标签页 |
| `apply-batch-action` | `search.js` `content.js` | 对那批标签页执行分组、关闭或收藏 |
| `open-tab-search` | `background.js` -> `content.js` | 在当前页面打开页内搜索浮层 |

## 5. 核心流程

### 5.1 AI 整理流程

主要在 [`background.js`](/Users/zhaolixing/GitHub/ai-tab-organizer-extension/background.js) 的 `organizeTabsWithAI()`。

执行顺序是：

1. 检查后台是否已有整理任务在跑，避免并发。
2. 读取本地设置，确认 API Key、模型、接口地址。
3. 读取目标窗口标签页，并交给 `getCandidateTabs()` 做第一层筛选。
4. 调 `requestAIOrganizationPlan()` 请求 AI 返回分组 JSON。
5. 调 `normalizeOrganizationPlan()` 把 AI 返回结果压成安全格式：
   - 只保留当前窗口里真实存在的 tab id
   - 自动去重
   - 少于 2 个标签页的分组会被丢掉
   - AI 漏掉的标签页会补进 `ungroupedTabIds`
6. 调 `applyOrganizationPlan()` 真正移动标签顺序并建立 tab groups。
7. 如果启用了实验功能，再调用 `rewriteTabTitlesWithAI()` 尝试临时简化网页标题。
8. 把结果写回 `organizationState`，供弹窗读取。

这个流程的特点是：AI 只负责给“建议”，最后真正落地前一定有本地兜一层。

### 5.2 搜索面板流程

搜索入口有两套：

1. 当前标签页允许注入时，`background.js -> openTabSearch()` 给活动页发 `open-tab-search` 消息，让 [`content.js`](/Users/zhaolixing/GitHub/ai-tab-organizer-extension/content.js) 在页面里起一个浮层。
2. 当前标签页是 `chrome://` 一类受限页面，或者消息发送失败，就退到独立窗口 [`search.html`](/Users/zhaolixing/GitHub/ai-tab-organizer-extension/search.html) + [`search.js`](/Users/zhaolixing/GitHub/ai-tab-organizer-extension/search.js)。

搜索支持三类结果：

1. 真实标签页
2. 命令型条目，例如 `arrange`、`设置`、`自然语言智能搜索`
3. 回退条目：如果没有匹配标签页，就把输入当成网址或搜索词

还有一个很容易忽略的点：

- 普通关键词搜索基于 `getSearchableTabs()`，范围是所有窗口里的标签页。
- 自然语言批量筛选基于当前窗口，独立搜索窗口会把 `sourceWindowId` 透传给后台，尽量把批量操作锁在来源窗口里。

### 5.3 自然语言批量操作

这是搜索界面里最有意思的一段。

1. 用户输入一句自然语言，例如“3天没打开过的标签”。
2. `content.js` 或 `search.js` 先进入 `natural` 模式。
3. 它们向后台发送 `preview-batch-tabs`。
4. 后台把当前窗口的候选标签页、域名、标题、`lastAccessed` 整理成 JSON 发给 AI。
5. AI 返回 `selectedTabIds`、`rationale`、`suggestedLabel`。
6. 前端先展示命中的标签页，再在底部显示批量动作按钮。
7. 用户确认后再发 `apply-batch-action`。

批量动作支持：

- `group`
- `delete`
- `bookmark`
- `bookmark_close`

搜索界面里真正露出的常用动作是：

- 新建分组
- 关闭搜索到的 Tab / 关闭所有
- 关闭并加入收藏 / 关闭全部并收藏

### 5.4 标题简化流程

标题简化是一个实验功能，主逻辑在 [`background.js`](/Users/zhaolixing/GitHub/ai-tab-organizer-extension/background.js)：

1. `shouldConsiderTitleRewrite()` 先筛出“值得改短”的网页标签。
2. `requestAITitleRewritePlan()` 让 AI 返回 `{ tabId, rewrittenTitle }[]`。
3. `normalizeTitleRewritePlan()` 做长度、去重、清洗。
4. `applyTemporaryTitleRewrite()` 用 `chrome.scripting.executeScript()` 改写页面 `document.title`。

这里的“改标题”不是持久化修改网页，只是对当前页面做临时注入。页面刷新、站点自己改标题，或者页面不允许注入时，这个效果都会消失。

## 6. 配置和持久化

扩展主要把配置存在 `chrome.storage.local`。

常见 key：

- `aiProviderPresetId`
- `aiEndpoint`
- `aiApiKey`
- `aiModel`
- `aiPreference`
- `experimentalTitleRewriteEnabled`
- `themeColor`
- `themeMode`

`ai-provider-config.js` 是这里的公共底座，负责：

- 提供常见厂商预置
- 自动识别 endpoint 对应的 provider
- 把只填到根路径或 `/v1` 的接口补全为 `/chat/completions`
- 处理模型下拉和自定义模型输入框的切换
- 通过挂到 `globalThis` 和 `module.exports`，同时服务浏览器页面和 Node 测试

这个文件被三个地方复用：

1. `options.js`
2. `search.js`
3. `content.js`

## 7. UI 分层

### 7.1 popup

[`popup.js`](/Users/zhaolixing/GitHub/ai-tab-organizer-extension/popup.js) 很轻，只做三件事：

1. 读取快捷键显示出来
2. 触发整理
3. 打开搜索或设置

它还会每 500ms 轮询一次 `get-organization-state`，但当前只用来控制“整理按钮是否禁用”，没有把阶段、日志、结果明细展示出来。

### 7.2 options

[`options.js`](/Users/zhaolixing/GitHub/ai-tab-organizer-extension/options.js) 是完整设置页，结构清楚，主要是表单绑定和保存。

### 7.3 content / search

[`content.js`](/Users/zhaolixing/GitHub/ai-tab-organizer-extension/content.js) 和 [`search.js`](/Users/zhaolixing/GitHub/ai-tab-organizer-extension/search.js) 共享同一套交互心智：

- 输入即过滤
- 上下方向键切换结果
- 左右方向键切换结果动作
- Enter 执行
- `Esc` 在模式间返回，或直接关闭面板

两者的差别主要在外观和容器：

- `content.js` 是页内浮层，带主题色、玻璃质感、图标、访问时间、内联主题切换
- `search.js` 是独立窗口，样式更朴素，也支持内联设置，但没有页内浮层那套视觉强化

## 8. 测试覆盖情况

现有测试只有两组：

1. [`tests/ai-provider-config.test.mjs`](/Users/zhaolixing/GitHub/ai-tab-organizer-extension/tests/ai-provider-config.test.mjs)
   覆盖 provider 预置、endpoint 归一化、模型选择、设置草稿恢复。
2. [`tests/options-page-scope.test.mjs`](/Users/zhaolixing/GitHub/ai-tab-organizer-extension/tests/options-page-scope.test.mjs)
   用 `vm` 模拟 `content.js` 和 `options.js` 在同一执行上下文里跑一遍，防止全局变量或重复定义把设置页搞崩。

目前还没有自动测试覆盖这些主业务：

- `background.js` 的消息分发
- AI 返回结果的归一化
- 分组、书签、关闭标签页等浏览器 API 调用
- `content.js` / `search.js` 的键盘导航和状态切换

## 9. 我看到的几个关键观察

### 9.1 `content.js` 和 `search.js` 有大量平行实现

这两个文件不是简单的“共享核心 + 薄皮肤”，而是复制了一整套很接近的状态机、结果构建逻辑、设置表单逻辑和动作执行逻辑。

这带来的直接影响是：

- 一个入口修了交互，另一个入口很容易忘记补
- 搜索规则、自然语言操作、设置逻辑容易慢慢长歪
- 测试成本会越来越高

如果后面要继续做搜索体验，最值得先收的就是这一块。

### 9.2 AI endpoint 归一化逻辑有两份

- [`ai-provider-config.js`](/Users/zhaolixing/GitHub/ai-tab-organizer-extension/ai-provider-config.js) 里有 `normalizeAIEndpoint()`
- [`background.js`](/Users/zhaolixing/GitHub/ai-tab-organizer-extension/background.js) 里还有一份 `normalizeEndpoint()`

两份逻辑目标类似，但规则并不完全一样。现在还能工作，不过后面一旦改 endpoint 规则，容易只改到一边。

### 9.3 README 需要跟着行为变化一起维护

这个项目的 README 不是纯介绍页，它里面写了不少“默认行为”。像标签过滤范围、搜索入口回退策略、弹窗实际展示内容，只要代码变了，README 就得一起改，不然很快就会出现“用户看到的是一套，代码跑的是另一套”。

比较值得长期盯住的几类描述：

1. 整理到底处理哪些标签页。
2. 搜索是全局范围，还是当前窗口范围。
3. 弹窗、设置页、搜索面板分别能看到什么。
4. 受限页面下会不会自动退到独立窗口。

### 9.4 搜索范围和批量范围不是一回事

当前代码把“搜索”和“批量操作”拆成了两个范围：

1. 关键词搜索会把所有窗口里的标签页都列出来，适合全局跳转。
2. 自然语言批量操作只拿当前窗口候选标签页去问 AI，适合当前上下文整理。

这个设计本身没问题，但如果后面有人只看 UI 表面，很容易误以为两者的作用范围一样。

### 9.5 当前代码是“浏览器 API 直接驱动”的直连式架构

好处是简单，没有额外抽象层。

代价是：

- 业务逻辑和 Chrome API 调用耦合得比较紧
- 想补单元测试时，要自己做一层 mock
- 后续如果要支持别的浏览器，迁移成本会比较高

## 10. 想改功能时应该先看哪里

### 改 AI 提供商、模型、endpoint 规则

先看：

- [`ai-provider-config.js`](/Users/zhaolixing/GitHub/ai-tab-organizer-extension/ai-provider-config.js)
- [`options.js`](/Users/zhaolixing/GitHub/ai-tab-organizer-extension/options.js)
- [`search.js`](/Users/zhaolixing/GitHub/ai-tab-organizer-extension/search.js)
- [`content.js`](/Users/zhaolixing/GitHub/ai-tab-organizer-extension/content.js)
- [`background.js`](/Users/zhaolixing/GitHub/ai-tab-organizer-extension/background.js)

### 改标签页整理策略

先看：

- [`background.js`](/Users/zhaolixing/GitHub/ai-tab-organizer-extension/background.js) 的 `organizeTabsWithAI()`
- `buildOrganizationPrompt()`
- `normalizeOrganizationPlan()`
- `applyOrganizationPlan()`

### 改搜索排序、命令入口、键盘交互

先看：

- [`content.js`](/Users/zhaolixing/GitHub/ai-tab-organizer-extension/content.js)
- [`search.js`](/Users/zhaolixing/GitHub/ai-tab-organizer-extension/search.js)

### 改主题和视觉

先看：

- [`ui.css`](/Users/zhaolixing/GitHub/ai-tab-organizer-extension/ui.css)
- [`theme.js`](/Users/zhaolixing/GitHub/ai-tab-organizer-extension/theme.js)
- [`content.js`](/Users/zhaolixing/GitHub/ai-tab-organizer-extension/content.js) 里的主题 token 配置

## 11. 一句话总结

这个项目的优点是路径短、功能完整、上手快；最值得留心的是后台逻辑已经比较集中，而两个搜索入口又复制了不少实现。后面如果继续迭代，优先把“搜索入口共用核心逻辑”这件事收一下，维护成本会明显更稳。
