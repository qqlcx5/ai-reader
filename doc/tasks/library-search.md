# 记忆库与搜索 (library-search)

- [ ] LibraryView 布局：`src/components/library/LibraryView.vue`，顶部 SearchBar 搜索框 + 热力图区域占位 + DocumentList 文档列表
- [ ] MiniSearch 索引初始化：`src/services/search/index.ts`，`new MiniSearch({ fields: ['title', 'url', 'siteName', 'markdown', 'excerpt'], storeFields: [...], searchOptions: { boost: { title: 3, siteName: 2, markdown: 1 }, fuzzy: 0.2, prefix: true } })`
- [ ] 实时搜索：`SearchBar.vue` 中 `@input` 防抖 300ms 后调用 `miniSearch.search(keyword)`，搜索结果按 score 降序排列，高亮匹配片段
- [ ] 空关键词展示最近捕获：搜索框为空时按 `capturedAt` 降序展示最近 20 条文档摘要
- [ ] DocumentItem 组件：`src/components/library/DocumentItem.vue`，展示 title（截断 40 字）、来源域名（favicon + hostname）、`dayjs(capturedAt).format(...)` 抓取时间、excerpt 摘要（截断 80 字）
- [ ] 文档点击行为：点击 DocumentItem → `documentStore.loadDocument(id)` 从 IndexedDB 加载 → `appStore.currentView = 'workspace'` → Workspace 显示该文档内容，Header 标记为"历史文档"
- [ ] "打开原网页"按钮：DocumentItem 操作区按钮，调用 `browser.tabs.create({ url: document.url })` 新 Tab 打开原网页
- [ ] 删除文档：点击删除按钮 → `ConfirmDialog` 确认 → 调用 `DocumentRepository.delete(id)` + 删除关联 Conversation + `miniSearch.remove(id)`，若被删文档是当前文档则 `documentStore.currentDocument = null`
- [ ] MiniSearch 索引同步：文档新增时 `miniSearch.add(doc)`，更新时 `miniSearch.replace(doc)`，删除时 `miniSearch.remove(id)`，导入数据后 `rebuild()`
- [ ] 热力图渲染：`src/components/library/Heatmap.vue`，基于文档 `capturedAt` 日期分布，用 SVG 或 Canvas 渲染 GitHub 风格贡献热力图，tooltip 悬停显示日期 + 文档数
