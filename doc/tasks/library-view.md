# library-view — 文章库 (LibraryView)

> 详细设计参考：doc/detail.md §3.7 (文章库模块)
> 现有代码：components/views/LibraryView.vue（已有 UI，搜索为内存 includes，数据来自 props）

依赖：storage (articleStore)

---

## 任务清单

### 1. 数据接入

- [ ] 替换 props 数据源为 Pinia `useArticleStore`
- [ ] `onMounted` 时调用 `articleStore.loadArticles()`
- [ ] 文章列表按 `createdAt` 降序排列

### 2. 搜索实现

- [ ] 搜索框 `v-model` 绑定 `keyword` ref
- [ ] Phase 1 搜索：对 title + siteName + author + excerpt 做 `string.includes(keyword)`（现有实现已基本完成）
- [ ] 移除对 `markdown` 字段的搜索（减少内存开销，Phase 2 再考虑）
- [ ] 搜索输入 300ms 防抖（`useDebounceFn` 或手写）
- [ ] 「清空搜索」按钮：清空 keyword，显示全部文章

### 3. Stats Chips

- [ ] 显示文章总数：`articleStore.articles.length`
- [ ] 显示存储类型：`IndexedDB`
- [ ] 显示搜索状态：有关键词时显示「搜索：xxx」，无关键词时显示「本地优先」

### 4. 文章列表交互

- [ ] 点击文章 → `emit('openReader', article.id)` 或直接操作 store `activeArticleId`
- [ ] 删除按钮 → `deleteTargetId = article.id` → 打开 ConfirmModal
- [ ] 确认删除 → `articleStore.deleteArticle(id)` → 列表自动更新
- [ ] 列表删除动画：先淡出再移除（可选，CSS transition）

### 5. 空状态

- [ ] 搜索无结果：显示「没有匹配文章」+ 「换个关键词，或回到采集页保存当前网页」
- [ ] 文章库为空：显示「还没有保存文章」+ 「在采集页保存你的第一篇文章」

### 6. 测试

- [ ] 搜索测试：输入关键词后列表实时过滤
- [ ] 删除测试：确认删除后文章从列表和 IndexedDB 中移除
- [ ] 空状态测试：清空所有文章后显示正确空状态

## 验收标准

- 文章库显示 IndexedDB 中的所有文章，按保存时间降序
- 搜索标题、作者、站点名可实时过滤
- 删除文章后列表立即更新，IndexedDB 中记录已删除
- 空文章库和搜索无结果均有友好提示
