# M1 入口与布局 — Vibe Coding 任务清单

> **目标**：搭建 Popup、Side Panel、Options 三个入口与全局快捷键，完成 UI 壳层。
> **输入**：`doc/1.md` 第一章、`doc/design-01-entry-layout.md`
> **建议执行顺序**：在 M7 存储层 stub 之后即可开始；部分功能需等待 M4 完成接入。

---

## 1. 环境 & 配置

- [ ] 安装 `reka-ui`、`@unocss/preset-uno`（或等效 UnoCSS 集成）到 WXT 项目
- [ ] 在 `wxt.config.ts` 中启用 UnoCSS 插件与自动导入
- [ ] 创建 `components/layout/` 与 `components/shared/` 目录
- [ ] 定义主题 token（颜色、字号、间距），写入 `styles/theme.css`

---

## 2. Side Panel 入口

- [ ] 在 `entrypoints/sidepanel/` 创建 `index.html` + `main.ts` + `App.vue`
- [ ] 配置 `wxt.config.ts` 的 `manifest.side_panel` 字段
- [ ] 实现 `SidePanelLayout.vue`：顶部上下文栏、中部内容区、底部输入区
- [ ] 验证通过 `chrome.sidePanel.open()` 可从 background 唤起

---

## 3. Popup 入口

- [ ] 重构 `entrypoints/popup/App.vue`：展示当前上下文摘要 + 操作按钮
- [ ] 实现 `ContextSummary.vue` 组件：标题、字数、状态
- [ ] 实现 `ActionBar.vue`：打开 Side Panel / 立即提取 / 进入设置
- [ ] 验证 Popup 打开时读取最新 `currentContext`

---

## 4. Options 设置页

- [ ] 在 `entrypoints/options/` 创建入口
- [ ] 实现 `OptionsLayout.vue` + `NavTabs.vue`：Provider / Prompts / Sync / RSS / Advanced
- [ ] 每个 Tab 先用占位内容填充，后续由 M3/M6/M8 填充具体表单
- [ ] 验证在 `chrome://extensions` → 扩展详情 → 扩展选项中可打开

---

## 5. 全局快捷键

- [ ] 在 `entrypoints/background.ts` 注册 `chrome.commands.onCommand` 监听
- [ ] 实现 `open-side-panel`（Alt/Option+S）：唤起 Side Panel 并触发提取
- [ ] 实现 `toggle-side-panel`（Alt/Option+P）：切换显隐
- [ ] 实现 `abort-all-generations`（Escape）：广播 `ABORT_ALL_REQUESTS` 消息
- [ ] 在 manifest 中声明三个 `commands` 及其默认快捷键
- [ ] 手动测试三个快捷键在 Chrome 中生效

---

## 6. 共享状态与组件

- [ ] 创建 `stores/ui.store.ts`，定义 `UIState` 与 `currentContext`
- [ ] 实现 `ThemeProvider.vue` 与暗黑/亮色切换
- [ ] 实现 `ContextStatusBar.vue`：显示标题、字数、刷新按钮
- [ ] 实现 `IconButton.vue`、`LoadingDots.vue`、`EmptyState.vue`
- [ ] 在三个入口中共享 `uiStore`，确保状态变更同步

---

## 7. 集成与验收

- [ ] Side Panel 加载后自动从 M7 恢复 `currentContext`
- [ ] 点击「刷新提取当前 Tab」向 Background 发送 `EXTRACT_PAGE` 消息
- [ ] Escape 快捷键能广播中断事件（M4/M5 订阅者后续消费）
- [ ] 在不同入口间切换时，UI 状态保持一致

---

## 验收标准

1. 三个入口页面均可在 WXT dev 模式下正常加载，无控制台报错。
2. 三个全局快捷键在 `chrome://extensions/shortcuts` 中可见且可触发。
3. Side Panel 能展示当前上下文状态栏，并支持刷新按钮。
4. Popup 能显示最近一次提取的字数与标题。

---

## 依赖提醒

- **阻塞项**：M7 存储层需至少提供 `currentContext` 的读写 stub。
- **后续接入**：M4 的 `ChatWorkspace` 将替换 Side Panel 中部内容区。
