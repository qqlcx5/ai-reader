# M8 存储与数据层 — Vibe Coding 任务清单 (v1)

> **目标**：基于 Dexie.js 搭建主副表读写分离的 IndexedDB 数据库，实现三级缓存策略（L1 内存 LRU / L2 持久化 TTL / L3 API 响应 Hash），定义所有核心接口类型。
> **输入**：`doc/proposal_v1.md` §4（底层数据结构设计）
> **依赖**：无（其他所有模块依赖此模块）

---

## 1. 依赖安装与数据库初始化

- [ ] 安装：`dexie`、`dexie-cloud-addon`（可选，用于后期云端扩展）
- [ ] 实现 `lib/db/database.ts`：
  ```typescript
  const db = new Dexie('ReadChatClipper')
  db.version(1).stores({
    Conversations: 'id, url, domain, updatedAt, createdAt',
    Messages:      'id',
    Highlights:    'id, pageId, domain',
    RSSFeeds:      'id, url',
    Templates:     'id, createdAt',
  })
  ```
- [ ] 导出 `db` 单例，所有 Repository 通过此单例访问
- [ ] 数据库升级策略：版本号 + `upgrade()` 迁移函数（预留 v2 schema 扩展位）

---

## 2. 核心接口类型定义

- [ ] 实现 `lib/db/types.ts`，定义所有 TypeScript 接口：

  ```typescript
  // 主表 Conversations（元数据，查询 < 5ms）
  interface ConversationRecord {
    id: string          // SHA-256(normalizeUrl)
    url: string
    title: string
    favicon: string
    domain: string
    createdAt: number
    updatedAt: number
    wordCount: number
    engine: 'readability' | 'defuddle' | 'fallback'
    messageCount: number
    models: string[]
  }

  // 副表 Messages（完整数据，仅点击时懒加载）
  interface MessageRecord {
    id: string
    rawText: string
    metadata: PageMetadata
    chatHistory: ChatMessage[]
  }

  interface ChatMessage {
    id: string
    role: 'system' | 'user' | 'assistant'
    content: string
    timestamp: number
    model?: string
    provider?: string
    ttft?: number
    tps?: number
    cost?: number
    cached?: boolean
  }

  interface PageMetadata {
    author?: string
    published?: string
    description?: string
    ogImage?: string
    schemaType?: string
    ogTitle?: string
    ogDescription?: string
  }

  // 高亮选区表
  interface HighlightRecord {
    id: string
    pageId: string
    domain: string
    selector: string
    text: string
    style: 'mark' | 'underline' | 'blur' | 'wave' | 'bold' | 'italic' | 'border'
    createdAt: number
  }

  // RSS 订阅源表
  interface RSSFeedRecord {
    id: string
    url: string
    title: string
    fetchInterval: number
    lastFetched: number
    articles: RSSArticleRecord[]
  }

  interface RSSArticleRecord {
    id: string
    link: string
    title: string
    summary: string
    publishedAt: number
    isRead: boolean
  }

  // 提示词模板表
  interface TemplateRecord {
    id: string
    name: string
    icon: string
    prompt: string
    urlPattern?: string
    schemaType?: string
    filters?: string[]
    createdAt: number
  }
  ```

---

## 3. 主表 Repository（Conversations）

- [ ] 实现 `lib/db/repositories/conversation.repo.ts`
  - `create(record: ConversationRecord): Promise<void>`
  - `findById(id: string): Promise<ConversationRecord | undefined>`
  - `list(options: { sortBy: 'updatedAt' | 'domain'; limit: number; offset: number }): Promise<ConversationRecord[]>`
  - `update(id: string, partial: Partial<ConversationRecord>): Promise<void>`（更新 `updatedAt` / `messageCount` / `models`）
  - `delete(id: string): Promise<void>`（级联删除副表 Messages + Highlights）
  - `count(): Promise<number>`
- [ ] 单元测试：CRUD 全覆盖，验证按 `updatedAt` 排序正确

---

## 4. 副表 Repository（Messages）

- [ ] 实现 `lib/db/repositories/message.repo.ts`
  - `save(record: MessageRecord): Promise<void>`（upsert）
  - `loadById(id: string): Promise<MessageRecord | undefined>`（懒加载，仅按 ID 查询）
  - `appendMessage(id: string, msg: ChatMessage): Promise<void>`（追加单条消息）
  - `deleteMessage(id: string, msgId: string): Promise<void>`
  - `truncateAfter(id: string, msgId: string): Promise<void>`（截断某消息之后的所有消息）
  - `delete(id: string): Promise<void>`
- [ ] **严禁**在此 Repo 提供批量扫描接口（防止在列表页误用）
- [ ] 单元测试：追加 100 条消息后按 ID 懒加载，验证数据完整

---

## 5. Highlights Repository

- [ ] 实现 `lib/db/repositories/highlight.repo.ts`
  - `saveHighlight(record: HighlightRecord): Promise<void>`
  - `listByPageId(pageId: string): Promise<HighlightRecord[]>`
  - `listByDomain(domain: string): Promise<HighlightRecord[]>`
  - `deleteByPageId(pageId: string): Promise<void>`
  - `exportByDomain(domain: string): Promise<HighlightRecord[]>`（导出用）

---

## 6. Templates Repository

- [ ] 实现 `lib/db/repositories/template.repo.ts`
  - `seedDefaultTemplates(): Promise<void>`（首次安装写入 6 个内置模板，跳过已存在）
  - `create / update / delete / listAll / findById`
  - `matchByUrl(url: string): Promise<TemplateRecord | null>`（正则匹配 URL 触发规则）
  - `matchBySchema(schemaType: string): Promise<TemplateRecord | null>`

---

## 7. RSS Repository

- [ ] 实现 `lib/db/repositories/rss.repo.ts`
  - `saveFeed(feed: RSSFeedRecord): Promise<void>`
  - `updateArticles(feedId: string, articles: RSSArticleRecord[]): Promise<void>`（哈希去重合并）
  - `markAsRead(feedId: string, articleId: string): Promise<void>`
  - `listFeeds(): Promise<RSSFeedRecord[]>`
  - `getUnreadCount(): Promise<number>`

---

## 8. Pinia Store 与持久化

- [ ] 安装 `pinia`、`@pinia/nuxt`（若使用 Nuxt）或直接集成到 Vue 3
- [ ] 实现 `stores/settings.store.ts`：
  - 存储 Provider 配置列表、全局代理开关、API Key（通过 key-store 读写）
  - 使用 `chrome.storage.local` 序列化（Pinia `$subscribe` + `setItem`）
  - Popup 与 Side Panel 共享同一份 settings 状态
- [ ] 实现 `stores/context.store.ts`：
  - `currentContext: ExtractionResult | null`（当前锚定页面的提取结果）
  - `currentPageId: string | null`
  - 跨 Tab 切换时保持不变（静默锚定）

---

## 9. 三级缓存实现

- [ ] **L1 内存缓存**（`lib/db/cache/l1-cache.ts`）：
  - LRU Map，容量 20 条
  - `get(key: string): T | undefined`
  - `set(key: string, value: T): void`（超容量时淘汰最久未用）
  - Key 格式：`extraction:{pageId}` / `apiResponse:{queryHash}`
- [ ] **L2 持久化缓存**（`lib/db/cache/l2-cache.ts`，IndexedDB）：
  - 相同 URL 的提取结果（`ExtractionResult`）TTL 24h
  - 命中 L2 时跳过提取，直接返回缓存，节省 2～8s
  - `get(pageId): CacheEntry | null`（校验 TTL）
  - `set(pageId, result, ttlMs = 86400000): void`
- [ ] **L3 API 响应缓存**（`lib/db/cache/l3-cache.ts`，IndexedDB）：
  - Key = `SHA-256(pageId + prompt + model)`（Content Hash）
  - `get(hash): string | null`
  - `set(hash, responseText): void`
  - 命中时 `ChatMessage.cached = true`，底栏显示 `⚡ Cached`
  - 手动清除接口：`clearAll()`

---

## 10. API Key 明文存储（chrome.storage.local）

- [ ] 实现 `lib/db/key-store.ts`：
  - `saveKey(providerId: string, apiKey: string): Promise<void>`
  - `getKey(providerId: string): Promise<string | null>`
  - `deleteKey(providerId: string): Promise<void>`
  - `listConfiguredProviders(): Promise<string[]>`（仅返回已配置 API Key 的 Provider ID）
- [ ] 确认 API Key 不写入 IndexedDB（仅 `chrome.storage.local`）

---

## 验收标准

1. `Conversations` 主表查询 1000 条记录耗时 < 5ms（Chrome DevTools IndexedDB 查询时间）。
2. `Messages` 副表懒加载 1MB JSON 耗时 < 200ms。
3. L1 缓存：同一 pageId 连续提取两次，第二次从 Map 命中，不访问 Dexie。
4. L2 缓存：访问同一 URL，24h 内第二次不调用 Readability，状态栏显示"L2 缓存命中"。
5. L3 缓存：相同 Prompt + 模型重复提问，`ChatMessage.cached = true`，底栏显示 `⚡ Cached`。
6. TypeScript 严格模式下无编译错误，所有 Repo 单元测试通过。
