# M1 入口与布局 — Vibe Coding 任务清单 (v1)

> **目标**：搭建 Popup、Side Panel、Options 三个扩展入口与全局快捷键，按 `design.html` + `design-tokens.md` 实现完整 UI 壳层与设计令牌系统。
> **输入**：`doc/proposal_v1.md` §3（UI/UX 交互设计）、`doc/design-tokens.md`、`doc/design.html`
> **依赖**：无强依赖，可最先启动；M8（存储层）完成后接入真实数据。

---

## 1. 设计令牌与全局样式

- [x] 在 `styles/theme.css` 中声明所有 CSS 变量（对齐 `design-tokens.md` §1 色彩系统）
  - `--obsidian-bg: #fcfcf9` / `--obsidian-panel: #ffffff` / `--obsidian-card: #faf9f5`
  - `--obsidian-border: #e6e2d8` / `--obsidian-borderStrong: #cfc9bc`
  - `--obsidian-text: #2e2d2a` / `--obsidian-muted: #7a7568` / `--obsidian-mutedLight: #a39d8f`
  - `--obsidian-primary: #5b60e5` / `--obsidian-primarySoft: #f0f1fe`
  - `--obsidian-green: #248a52` / `--obsidian-greenSoft: #eefaf2`
  - `--obsidian-orange: #ca7a15` / `--obsidian-orangeSoft: #fff9ee`
  - `--obsidian-red: #d14343` / `--obsidian-redSoft: #fdf4f4`
- [x] 配置全局 `scrollbar` 样式（thumb `#dedad0`，`rounded-full`，宽度 8px）
- [x] 配置 `.markdown-content` 基础样式类（H1/H2/P/UL/OL/Pre/Code 各级样式）
- [x] 定义 `.typing-cursor::after` 流式光标（`▋`，`animate-pulse`，`text-obsidian-primary`）
- [x] 配置 Tailwind / UnoCSS 扩展 `obsidian` 色板使 `bg-obsidian-primary` 等工具类可用

---

## 2. Popup 弹窗（扩展轻量端）

- [x] 在 `entrypoints/popup/App.vue` 实现固定 330px 宽弹窗容器
  - 白色背景 + `border-obsidian-borderStrong` + `shadow-2xl` + `rounded-2xl` + `overflow-hidden`
- [x] 实现顶部标题栏：`bg-obsidian-card` + `border-b`，展示扩展图标与"AI Reader Popup"文字
- [x] 实现当前页信息卡片：
  - 标题（截断 `truncate`）、本地字数（`font-mono`）、预估 Context Token
  - 背景 `bg-obsidian-bg` + `border` + `rounded-xl`
- [x] 实现双操作按钮：
  - 【触发一键解析】：`bg-obsidian-primary` 紫色，白色文字，`rounded-xl`，`shadow-sm`
  - 【Options 设置页】：白色背景，`border-obsidian-border`，`rounded-xl`
- [x] Popup 出现 / 消失动画：`scale 0.95 → 1 + opacity`，150ms `ease-out` 进 / 100ms `ease-in` 出

---

## 3. Side Panel 三区布局

- [x] 配置 `wxt.config.ts` 开启 `manifest.side_panel`，使用 Chrome Side Panel API
- [x] 实现 `SidePanelLayout.vue`：三区垂直 flex 布局
  ```
  Header 64px（上下文锚定栏）
  状态条 32px（提取状态）
  Chat View（flex-1，overflow-y-scroll）
  Input Box（自适应高度）
  ```
- [x] 验证通过 `chrome.sidePanel.open()` 可从 background 唤起侧边栏

---

## 4. 顶部上下文锚定栏（Header）

- [x] 实现 `ContextStatusBar.vue`，高度 64px，`border-b border-obsidian-border`
- [x] 左侧：40px 圆角 favicon 图标 + 页面标题（`text-xs font-bold`，`truncate`）+ 字数 badge
- [x] 右侧：模型切换下拉框 + "提取当前 Tab"紫色主按钮（`rounded-xl` + `shadow-sm`）
- [x] 右侧附加："模拟切换网页"边框按钮（测试用，可选）
- [x] 模型切换下拉框：显示当前模型名 + 厂商色点，展开后分组（云端 / 本地），已配置 Provider 高亮

---

## 5. 全局提取状态条

- [x] 实现 `ExtractionStatusBar.vue`，高度约 32px，`bg-obsidian-bg/60`
- [x] 展示：提取引擎标签（`Readability` / `Defuddle` / `Fallback`）、`IndexedDB` 状态、字数
- [x] `No Truncation` badge：`bg-obsidian-greenSoft` + `text-obsidian-green` + `rounded-full`，`text-[10px] font-bold uppercase tracking-wider`

---

## 6. 桌面端三栏布局（Options / 管理页）

- [x] 实现 `ThreeColumnLayout.vue`：`grid-template-columns: 250px 1fr 360px; gap: 12px; padding: 12px; height: 100vh;`
- [x] 左栏（固定 250px）：品牌区 + 主导航 + 技术上下文
- [x] 中栏（1fr）：主工作区，可切换 Chat / Panel 视图
- [x] 右栏（固定 360px）：6 标签面板（历史 / RSS / 工作流 / 导出 / 设置 / 架构）
- [x] 响应式断点：
  - `< 1250px`：隐藏右栏
  - `< 820px`：隐藏左栏
  - 移动端：单列布局

---

## 7. 左栏品牌区与主导航

- [x] 实现 `BrandHeader.vue`：64px 高 header
  - 品牌图标：40px 圆角矩形，渐变 `from-obsidian-primary to-[#8fa6ff]`，白色文字 `AR`
  - 品牌标题：`font-black text-sm`，版本号 `text-[10px] text-obsidian-muted`
- [x] 实现 `MainNav.vue`：垂直导航按钮列表
  - 激活态：`bg-obsidian-primarySoft` + `text-obsidian-primary` + `border border-[#d2d6ff]` + `font-extrabold` + `rounded-xl`
  - 未激活态：透明背景 + `text-obsidian-text`，hover `bg-obsidian-bg`
  - 图标：左侧 16px SVG，文字 `text-xs`
  - RSS 未读计数：右侧 `rounded-full` badge，`bg-obsidian-primary`，白色 `text-[9px]`

---

## 8. 右栏 6 标签面板

- [x] 实现 `RightPanelTabs.vue`：6 等分标签栏
  - 激活态：`border-b-2 border-obsidian-primary`，`text-obsidian-primary`，白色背景
  - 未激活态：边框透明，`text-obsidian-muted`，hover `text-obsidian-text`
  - 字体：`text-[11px] font-extrabold`
- [x] 每个标签内容卡片：白色背景 + `border-obsidian-border` + `rounded-xl` + `space-y-2.5`
- [x] 历史 Tab：接入 M6 历史列表组件占位
- [x] RSS Tab：接入 M9 RSS 面板占位
- [x] 工作流 Tab：接入 M5 工作流面板占位
- [x] 导出 Tab：接入 M7 导出面板占位
- [x] 设置 Tab：Provider Key / 模板 / 同步配置表单
- [x] 架构 Tab：展示工程实现说明（静态 Markdown 渲染）

---

## 9. Options 设置页（独立管理面板）

- [x] 在 `entrypoints/options/` 创建入口 `index.html` + `App.vue`
- [x] 实现 `OptionsLayout.vue`：宽屏大面板，三栏布局（ThreeColumnLayout）
  - Provider 密钥管理（含 API Key 输入、Base URL 覆盖、代理设置）
  - 提示词模板管理（列表 + 编辑器）
  - 同步与备份凭据（WebDAV / S3 配置）
  - RSS 订阅源管理
- [x] 左侧历史记录列表：favicon + 标题 + 抓取时间
- [x] 右侧分屏：Tab 1 提取正文快照（Markdown 渲染）+ Tab 2 对话历史

---

## 10. 全局快捷键

- [x] 在 `wxt.config.ts` 中配置 `commands`：
  - `Alt+S`：唤起侧边栏并静默提取当前页
  - `Alt+P`：显隐侧边栏
  - `Escape`：广播 `ABORT_ALL` 消息，中断所有网络请求
- [x] 在 `background.ts` 中监听 `chrome.commands.onCommand`，分发对应操作
- [x] `Escape` 中断广播：`chrome.runtime.sendMessage({ type: 'ABORT_ALL' })`，所有 SSE 连接响应 `AbortController.abort()`

---

## 11. 通用共享组件

- [x] `IconButton.vue`：小型图标操作按钮（`rounded-lg` / `rounded-xl`，hover 背景变化）
- [x] `LoadingDots.vue` / `SpinnerIcon.vue`：`animate-spin` / `animate-pulse`
- [x] `EmptyState.vue`：空状态插画 + 提示文字
- [x] `ToastNotification.vue`：底部居中，深色 `#2d2c29`，`rounded-full`，左侧 pulsing 色点，`translate-y` 动画
- [x] `ModalDialog.vue`：遮罩 `rgba(0,0,0,0.35) + backdrop-blur-sm`，`rounded-2xl + shadow-2xl`，标题栏 `bg-obsidian-card`，底部 `bg-obsidian-bg`，`scale` 动画

---

## 验收标准

1. Popup 330px 弹窗样式完全对齐 `design.html` 截图，动画流畅。
2. Side Panel 三区布局在 Chrome Side Panel 中正常渲染，顶部锚定栏显示 favicon + 标题 + No Truncation badge。
3. 桌面端三栏布局在 1440px 宽度正常展示，1250px 以下自动隐藏右栏，820px 以下自动隐藏左栏。
4. `Alt+S` / `Alt+P` / `Escape` 快捷键均有响应。
5. Toast 和 Modal 动画均符合 150ms/100ms 规范。
