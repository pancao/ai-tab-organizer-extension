# AI Tab Organizer

一个独立的 Chrome 扩展，用 AI 整理当前窗口里的标签页，并把整理状态直接显示在弹窗里。

## 功能

- 搜索已打开标签页并快速跳转
- 搜不到时，如果输入内容像网址，则直接新开标签页
- 在受限页面（如 `chrome://`）按快捷键时，会自动弹出独立搜索窗口
- 在 `Cmd+Shift+K` 面板中输入 `arrange`，回车可直接触发 AI 重排
- 键盘选中搜索结果后，可用右方向键切换“打开 / 关闭”，回车确认
- 鼠标悬停结果时，会直接显示“打开 / 关闭”按钮
- 在弹窗里用自然语言筛出一批 tab，然后执行分组、删除、加入书签
- 读取当前窗口里的未固定网页标签页
- 调用兼容 OpenAI Chat Completions 的 AI 接口
- 让 AI 生成排序和分组方案
- 自动重新排列标签页并创建 tab groups
- 在扩展弹窗里显示实时状态：
  - 检查设置
  - 读取标签页
  - 请求 AI
  - 校验方案
  - 应用方案
  - 完成或失败

## 快捷键

- macOS: `Command+Shift+K` 搜索标签页
- Windows / Linux: `Ctrl+Shift+K` 搜索标签页
- macOS: `Command+Shift+J`
- Windows / Linux: `Ctrl+Shift+J`

## 使用方法

1. 打开 `chrome://extensions`
2. 开启“开发者模式”
3. 点击“加载已解压的扩展程序”
4. 选择这个目录
5. 打开扩展弹窗，点击“打开设置”
6. 填写 AI 接口地址、API Key、模型名
7. 回到弹窗点击“开始整理”

接口地址可以填：

- 完整地址：`https://api.openai.com/v1/chat/completions`
- 或基础地址：`https://api.openai.com/v1`

如果你只填到根路径或 `/v1`，插件会自动补全到 Chat Completions 路径。

## 默认行为

- 只整理当前窗口
- 只处理未固定的网页标签页
- Chrome 内置页和扩展页不会被纳入整理
- 如果 AI 漏掉某些标签页，扩展会自动把它们补回方案里，避免遗漏

## 文件说明

- `manifest.json`: 扩展权限、弹窗、设置页、快捷键
- `background.js`: AI 调用、排序和 tab group 应用逻辑
- `background.js`: 也负责自然语言筛选 tab、批量分组/删除/书签
- `content.js`: 页面内标签页搜索面板
- `popup.html` / `popup.js`: 弹窗界面和整理状态展示
- `options.html` / `options.js`: AI 接口设置
- `ui.css`: 弹窗和设置页样式
