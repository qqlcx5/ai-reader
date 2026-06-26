# settings — 设置模块 (SettingsView)

> 详细设计参考：doc/detail.md §3.10 (设置模块)
> 现有代码：components/views/SettingsView.vue（已有 UI，设置为内存 ref，未持久化）

依赖：storage (settingsStore)

---

## 任务清单

### 1. Pinia Store 接入

- [ ] 替换 `SettingsView.vue` 中的内存 `ref` 为 Pinia `useSettingsStore`
- [ ] `onMounted` 时调用 `settingsStore.loadSettings()`
- [ ] Toggle 变化时调用 `settingsStore.updateSettings({ [key]: newValue })`

### 2. 设置项实现

| 设置 | 默认值 | 说明 |
|---|---|---|
| autoSave | true | 提取成功后自动保存到 IndexedDB |
| showToast | true | 操作完成后显示 Toast |
| includeFrontmatter | true | Markdown 顶部写入元数据（title, url, author 等） |
| readerStyle | true | 使用高级阅读排版（Apple 风格间距、卡片、边框） |

- [ ] `autoSave`：控制 capture-view 提取完成后是否自动调用 `articleStore.saveArticle()`
- [ ] `showToast`：控制 Toast 组件是否显示（在 Toast 组件中读取此设置）
- [ ] `includeFrontmatter`：控制 `markdown.service.ts` 是否在 Markdown 顶部生成 frontmatter
- [ ] `readerStyle`：控制 ReaderView 是否应用高级排版样式（CSS class toggle）

### 3. 恢复默认

- [ ] 「恢复默认」按钮调用 `settingsStore.resetSettings()`
- [ ] 重置后 Toast：「已恢复默认设置」
- [ ] UI 立即反映新值（reactive binding）

### 4. 持久化确认

- [ ] 确认设置通过 `chrome.storage.sync` 持久化（storage.md 中的 SettingsRepository）
- [ ] Popup 关闭再打开，设置保持
- [ ] 设置变化后 Toast 提示「设置已保存」

### 5. Storage 信息卡片

- [ ] 保持现有 Storage 信息卡片 UI（显示本地优先架构说明）
- [ ] 后续可扩展为显示 IndexedDB 使用量、导出/导入功能入口

### 6. 测试

- [ ] Toggle 测试：切换后 chrome.storage.sync 中值已更新
- [ ] 恢复默认测试：所有设置回到 DEFAULT_SETTINGS
- [ ] 持久化测试：刷新 Popup 后设置保持

## 验收标准

- 设置切换后立即生效并持久化
- 恢复默认后所有设置回到初始值
- `autoSave: false` 时提取完成后不自动保存，显示「保存」按钮
- `includeFrontmatter: false` 时复制的 Markdown 不含 frontmatter
