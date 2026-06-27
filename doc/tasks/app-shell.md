# App Shell + 导航 (app-shell)

- [x] TopBar 组件：`components/auramind/TopBar.vue`，使用 appStore/workspaceStore，根据 currentView 动态显示副标题（"当前网页上下文" / "本地知识库" / "模型与配置" / "正在解析当前页面..."）
- [x] app.store.ts：定义 `currentView: 'workspace' | 'library' | 'settings'`，`activeTab: { id, url, title }`，`showPageChangeHint: boolean`，`toast` 消息队列
- [x] AppShell.vue：`entrypoints/sidepanel/App.vue` 使用 `v-show` 按 `appStore.currentView` 切换 WorkspaceView / LibraryView / SettingsView
- [x] 副标题动态更新：TopBar 中根据 `appStore.currentView` 和 `workspaceStore.isExtracting` 动态显示副标题
- [x] 浏览器 Tab 切换感知：background.ts 通过 `browser.runtime.sendMessage` 向 sidepanel 广播 `TAB_ACTIVATED` / `TAB_UPDATED` 事件，App.vue 接收后更新 `activeTab` 并设置 `showPageChangeHint = true`
- [x] 页面变化提示条：PageChangeHint.vue 在 Workspace 顶部渲染黄色提示条"浏览器当前页面已变化，[切换到当前页面]"
- [x] Library 选文档自动跳转 Workspace：在 LibraryView 中点击文档后，设置 `documentStore.currentDocument`，切换 `appStore.currentView` 为 `'workspace'`
