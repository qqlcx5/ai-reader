# 唤醒层：本地全文检索 (Search)

## 目标
当 documents 写入后，异步更新本地搜索索引，实现秒级甚至毫秒级全文检索。

## 最小可执行任务

### 1. MiniSearch 集成
- [ ] 安装 `minisearch` 依赖（参考 `obsidian-clipper` 的搜索实现或外部库）
- [ ] 创建 `core/search/search.client.ts`（主线程搜索客户端，参考 `popup.ts` 的搜索逻辑）
- [ ] 配置 MiniSearch（参考 `obsidian-clipper` 的搜索配置或文档）：
  - `fields: ['title', 'markdownContent']`
  - `storeFields: ['id', 'title', 'url', 'createdAt']`
  - `searchOptions.boost: { title: 3, markdownContent: 1 }`
  - `fuzzy: 0.2, prefix: true`

### 2. Web Worker 搭建
- [ ] 创建 `workers/search.worker.ts`（参考 `obsidian-clipper` 的 Web Worker 模式或自建）
- [ ] Worker 内部独立创建 Dexie 实例读取 `documents` 表（参考 `db/dexie.ts` 的表定义）
- [ ] 实现 `INIT_INDEX`：启动时全量重建索引（参考 `popup.ts` 的初始化加载）
- [ ] 实现 `UPSERT_DOCUMENT`：增量添加/更新单篇（参考 `storage-utils.ts` 的更新模式）
- [ ] 实现 `REMOVE_DOCUMENT`：增量删除单篇（参考 `storage-utils.ts` 的数据清理）
- [ ] 实现 `SEARCH`：执行查询并返回结果（参考 `popup.ts` 的搜索逻辑）
- [ ] 定义 Worker 消息协议（参考 `types.ts` 的接口定义风格）

### 3. 主线程搜索客户端
- [ ] 创建 `SearchClient` 类封装 Worker 通信（参考 `popup.ts` 的消息发送模式）
- [ ] 初始化时发送 `INIT_INDEX` 消息（参考 `background.ts` 的启动逻辑）
- [ ] 监听 `INDEX_READY` 事件（参考 `content.ts` 的事件监听模式）
- [ ] 提供 `search(query)` API（返回 Promise，参考 `popup.ts` 的异步搜索）
- [ ] 提供 `upsert(documentId)` / `remove(documentId)` API（参考 `storage-utils.ts` 的更新模式）
- [ ] 处理 Worker 错误和重启（参考 `background.ts` 的错误处理）

### 4. 搜索页面 UI
- [ ] 创建 `entrypoints/sidepanel/pages/SearchPage.vue`（参考 `popup.ts` 的搜索 UI 和 `side-panel.html`）
- [ ] 搜索输入框（实时搜索，防抖 300ms，参考 `debounce.ts`）
- [ ] 搜索结果列表：标题 + 摘要 + 日期（参考 `popup.ts` 的结果展示）
- [ ] 高亮匹配关键词（参考 `highlighter.ts` 的高亮逻辑）
- [ ] 点击结果打开文档详情（跳转 Chat 页面，参考 `popup.ts` 的页面切换）
- [ ] 空状态提示（参考 `popup.ts` 的空状态处理）
- [ ] 加载状态（索引重建时，参考 `popup.ts` 的加载状态）

### 5. 索引增量更新机制
- [ ] 文档捕获后：Background → Worker `UPSERT_DOCUMENT`（参考 `background.ts` 的消息转发）
- [ ] 文档删除后：Background → Worker `REMOVE_DOCUMENT`（参考 `storage-utils.ts` 的数据清理）
- [ ] Worker 内部读取文档并 `addDocument()` / `remove()`（参考 MiniSearch API）
- [ ] 更新耗时 < 10ms（单篇，参考 `popup.ts` 的性能要求）
- [ ] ✅ **Worker 通信使用 `chrome.runtime.sendMessage` / `chrome.runtime.connect`**（参考 chrome-extensions 规则 #5）

### 6. 搜索降级策略
- [ ] MiniSearch 索引失败时，降级为 Dexie `where('title').startsWith(query)`（参考 `storage-utils.ts` 的查询模式）
- [ ] 降级提示："搜索索引异常，使用简单匹配"（参考 `popup.ts` 的错误提示）
- [ ] 后台自动尝试重建索引（参考 `background.ts` 的恢复逻辑）

---

## 验收标准
- [ ] 万级文档全量索引重建 < 1s（参考 `popup.ts` 的加载性能）
- [ ] 搜索响应 < 100ms（主线程无阻塞，参考 Worker 架构）
- [ ] 增量更新 < 10ms（参考 `storage-utils.ts` 的更新性能）
- [ ] 标题匹配权重高于正文（标题命中排前，参考 `searchOptions.boost`）
- [ ] 索引失败不影响主流程，有降级方案（参考 `popup.ts` 的错误处理）

## 依赖模块
- `db/dexie.ts`（documents 表，参考 `storage-utils.ts`）
- `entrypoints/sidepanel/`（搜索页面，参考 `popup.ts` 和 `side-panel.html`）
- `entrypoints/background.ts`（通知 Worker 更新，参考 `background.ts` 的消息路由）

## 参考资料
- [chrome-extensions] skill - Message Passing
- `obsidian-clipper/popup.ts` - 搜索逻辑
- `obsidian-clipper/background.ts` - 消息路由
