# 唤醒层：本地全文检索 (Search)

## 目标
当 documents 写入后，异步更新本地搜索索引，实现秒级甚至毫秒级全文检索。

## 最小可执行任务

### 1. MiniSearch 集成
- [ ] 安装 `minisearch` 依赖
- [ ] 创建 `core/search/search.client.ts`（主线程搜索客户端）
- [ ] 配置 MiniSearch：
  - `fields: ['title', 'markdownContent']`
  - `storeFields: ['id', 'title', 'url', 'createdAt']`
  - `searchOptions.boost: { title: 3, markdownContent: 1 }`
  - `fuzzy: 0.2, prefix: true`

### 2. Web Worker 搭建
- [ ] 创建 `workers/search.worker.ts`
- [ ] Worker 内部独立创建 Dexie 实例读取 `documents` 表
- [ ] 实现 `INIT_INDEX`：启动时全量重建索引
- [ ] 实现 `UPSERT_DOCUMENT`：增量添加/更新单篇
- [ ] 实现 `REMOVE_DOCUMENT`：增量删除单篇
- [ ] 实现 `SEARCH`：执行查询并返回结果
- [ ] 定义 Worker 消息协议（`SearchWorkerRequest` / `SearchWorkerResponse`）

### 3. 主线程搜索客户端
- [ ] 创建 `SearchClient` 类封装 Worker 通信
- [ ] 初始化时发送 `INIT_INDEX` 消息
- [ ] 监听 `INDEX_READY` 事件
- [ ] 提供 `search(query)` API（返回 Promise）
- [ ] 提供 `upsert(documentId)` / `remove(documentId)` API
- [ ] 处理 Worker 错误和重启

### 4. 搜索页面 UI
- [ ] 创建 `entrypoints/sidepanel/pages/SearchPage.vue`
- [ ] 搜索输入框（实时搜索，防抖 300ms）
- [ ] 搜索结果列表：标题 + 摘要 + 日期
- [ ] 高亮匹配关键词
- [ ] 点击结果打开文档详情（跳转 Chat 页面）
- [ ] 空状态提示
- [ ] 加载状态（索引重建时）

### 5. 索引增量更新机制
- [ ] 文档捕获后：Background → Worker `UPSERT_DOCUMENT`
- [ ] 文档删除后：Background → Worker `REMOVE_DOCUMENT`
- [ ] Worker 内部读取文档并 `addDocument()` / `remove()`
- [ ] 更新耗时 < 10ms（单篇）

### 6. 搜索降级策略
- [ ] MiniSearch 索引失败时，降级为 Dexie `where('title').startsWith(query)`
- [ ] 降级提示："搜索索引异常，使用简单匹配"
- [ ] 后台自动尝试重建索引

---

## 验收标准
- [ ] 万级文档全量索引重建 < 1s
- [ ] 搜索响应 < 100ms（主线程无阻塞）
- [ ] 增量更新 < 10ms
- [ ] 标题匹配权重高于正文（标题命中排前）
- [ ] 索引失败不影响主流程，有降级方案

## 依赖模块
- `db/dexie.ts`（documents 表）
- `entrypoints/sidepanel/`（搜索页面）
- `entrypoints/background.ts`（通知 Worker 更新）
