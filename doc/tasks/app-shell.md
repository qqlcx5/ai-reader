# App Shell + 导航 (app-shell)

- [ ] TopBar 组件：`src/components/common/TopBar.vue`，包含 AuraMind Logo（SVG 或 Lucide `Brain` 图标）、副标题文本、三个一级视图切换按钮（Workspace / Library / Settings，用 Lucide 图标）
- [ ] app.store.ts：定义 `currentView: 'workspace' | 'library' | 'settings'`，`activeTab: { id, url, title }`，`showPageChangeTip: boolean`，`toast` 消息队列
- [ ] AppShell.vue：`src/components/common/AppShell.vue` 使用 `v-show` 按 `appStore.currentView` 切换 WorkspaceView / LibraryView / SettingsView 三个一级页面
- [ ] 副标题动态更新：TopBar 中根据 `appStore.currentView` 和 `workspaceStore.extractionStatus` 动态显示副标题（"当前网页上下文" / "本地知识库" / "模型与配置" / "正在解析当前页面" / "页面解析失败"）
- [ ] 浏览器 Tab 切换感知：background.ts 通过 `browser.runtime.sendMessage` 向 sidepanel 广播 `TAB_ACTIVATED` / `TAB_UPDATED` 事件，app.store.ts 接收后更新 `activeTab` 并设置 `showPageChangeTip = true`
- [ ] 页面变化提示条：当 `showPageChangeTip` 为 true 且用户当前在查看历史文档时，在 Workspace 顶部渲染黄色提示条"浏览器当前页面已变化，[切换到当前页面]"
- [ ] Library 选文档自动跳转 Workspace：在 LibraryView 中点击文档后，设置 `documentStore.currentDocument`，AppShell 自动将 `appStore.currentView` 切换为 `'workspace'`
