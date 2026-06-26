# popup-shell — SidePanel Shell 入口与路由

> 详细设计参考：doc/detail.md §3.1 (Shell 模块)
> 现有代码：entrypoints/sidepanel/（已有完整 UI 壳，使用 demo data）
> UI 形态：SidePanel（沿用现有实现，非 Popup）

技术栈：Vue 3 Composition API、Pinia、WXT

---

## 任务清单

### 1. SidePanel 入口确认

- [ ] 确认 `entrypoints/sidepanel/index.html` 存在且正确（已有）
- [ ] 确认 `entrypoints/sidepanel/main.ts` Vue + Pinia + UnoCSS 初始化（已有，需添加 Pinia）
- [ ] 确认 `entrypoints/sidepanel/style.css` 全局 reset 已就绪（已有）
- [ ] 确认 `entrypoints/background.ts` 中 `sidePanel.setPanelBehavior` 配置正确（已有）

### 2. App.vue 重构

- [ ] 在 `entrypoints/sidepanel/main.ts` 中添加 Pinia `createPinia()`
- [ ] 替换 App.vue 中的 demo 数据为 Pinia store（`useArticleStore`, `useSettingsStore`）
- [ ] 初始化：Popup `onMounted` 时调用 `articleStore.loadArticles()` + `settingsStore.loadSettings()`
- [ ] 将 `navigate()` 函数改为操作 Pinia store 的 `currentView` 状态
- [ ] 将 `openReader()` 改为设置 store 中的 `activeArticleId` 并切换视图
- [ ] 删除 ConfirmModal 的空 handler，连接到 `articleStore.deleteArticle()`

### 3. TopBar 组件适配

- [ ] 更新 TopBar.vue：Local 状态 pill 动态显示存储状态（IndexedDB 可用 / 不可用）
- [ ] 设置按钮点击导航到 settings 视图

### 4. BottomNav 组件适配

- [ ] 确认 BottomNav 三个 tab（采集、文章库、阅读）的导航目标
- [ ] 阅读 tab：无文章时点击应提示「先保存一篇文章」

### 5. SidePanel 生命周期

- [ ] 确认 SidePanel 关闭后重新打开，Pinia store 重新从 IndexedDB 加载数据
- [ ] 确认提取过程中 SidePanel 关闭，下次打开时不会处于中间状态（captureStep 重置为 idle）

### 6. WXT manifest 配置

- [ ] 确认 `wxt.config.ts` 中 permissions 包含 `activeTab`, `scripting`, `storage`, `sidePanel`
- [ ] 确认 content_scripts 配置正确（`<all_urls>` 或 `optional_host_permissions`）

## 验收标准

- `npm run dev` 后点击扩展图标打开 SidePanel
- 四个视图（capture/library/reader/settings）可正常切换
- SidePanel 关闭再打开，数据不丢失
- 从 Pinia store 读取真实数据，不再使用 demo data
