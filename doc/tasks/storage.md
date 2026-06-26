# storage — IndexedDB (Dexie) + chrome.storage.sync 混合存储

> 详细设计参考：doc/detail.md §3.5 (存储模块)、§3.10 (设置模块)

技术栈：Dexie.js（IndexedDB 封装）、chrome.storage.sync（设置）

---

## 任务清单

### 1. Dexie 数据库初始化

- [ ] 创建 `db/index.ts`，实例化 Dexie `PageMindDB`，版本 1，定义 `articles` store schema（`++id, url, createdAt, updatedAt, siteName, title`）
- [ ] 确保 Dexie 仅在 Popup 上下文中初始化（Service Worker 无法访问 IndexedDB）

### 2. ArticleRepository

- [ ] 创建 `db/article.repository.ts`
- [ ] 实现 `saveArticle(article)` —— 同 URL 覆盖更新，保留 `createdAt`，更新 `updatedAt`
- [ ] 实现 `getArticle(id)` —— 按主键查询
- [ ] 实现 `getArticleByUrl(url)` —— 利用 `url` 索引查询
- [ ] 实现 `listArticles()` —— 按 `createdAt` 降序排列
- [ ] 实现 `searchArticles(keyword)` —— Phase 1 对 title + siteName + author + excerpt 做内存 `includes()` 过滤
- [ ] 实现 `deleteArticle(id)` —— 按主键删除
- [ ] 实现 `getRecentArticles(limit = 3)` —— 取最近 N 篇

### 3. SettingsRepository (chrome.storage.sync)

- [ ] 创建 `db/settings.repository.ts`
- [ ] 实现 `getSettings()` —— 读取 `pagemind_settings` key，不存在时返回 `DEFAULT_SETTINGS`
- [ ] 实现 `updateSettings(partial)` —— merge 更新后写回
- [ ] 实现 `resetSettings()` —— 写回 `DEFAULT_SETTINGS`

### 4. Pinia Store 接入

- [ ] 创建 `stores/article.store.ts`（Pinia store），状态：`articles: Article[]`, `activeArticleId: string | null`
- [ ] 实现 actions：`loadArticles()`, `saveArticle()`, `deleteArticle()`, `getRecentArticles()`
- [ ] 创建 `stores/settings.store.ts`（Pinia store），状态：`settings: AppSettings`
- [ ] 实现 actions：`loadSettings()`, `updateSettings()`, `resetSettings()`
- [ ] Popup 打开时自动调用 `loadArticles()` 和 `loadSettings()`

### 5. 测试

- [ ] 编写 ArticleRepository 单元测试：增删查改、重复 URL 覆盖、排序、搜索
- [ ] 编写 SettingsRepository 单元测试：默认值、更新、重置

## 验收标准

- 保存 3 篇 demo 文章后刷新 Popup，文章仍在
- 同一 URL 二次保存覆盖原记录，`createdAt` 不变
- 设置 toggle 后刷新 Popup，设置保持
- `resetSettings()` 恢复全部默认值
