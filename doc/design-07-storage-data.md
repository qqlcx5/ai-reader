# M7 存储与数据层（Storage & Data）详细设计

> **版本**：v1.0
> **对应 PRD**：第三章技术选型（Dexie、Pinia）、第四章长文本与海量数据架构
> **设计原则**：存储层是整个系统的数据底座；通过主副表分离、虚拟滚动、Worker 检索等机制支撑百万 Token 级数据与上万条历史记录。

---

## 1. 设计目标

- 使用 Dexie.js 承载 IndexedDB 存储，突破 `chrome.storage.local` 的 5MB 限制。
- 主副表分离：主表仅存元数据，副表按 ID 懒加载超长消息体。
- 实现 Pinia 与 `chrome.storage.local` 的同步，保障 Popup、Side Panel、Options 状态互通。
- 支持虚拟滚动历史列表、Web Worker 全文检索、大文本分片缓存。
- 按用户要求，API Key 与 Provider 配置以**明文**存储在 `chrome.storage.local`。

---

## 2. 职责边界

| 职责 | 属于本模块 | 不属于本模块 |
|---|---|---|
| Dexie 数据库 schema 设计与迁移 | ✅ |  |
| 主副表分离 | ✅ |  |
| Pinia 持久化与跨入口同步 | ✅ |  |
| 历史记录虚拟滚动数据源 | ✅ |  |
| Web Worker 全文检索 | ✅ |  |
| API Key 明文存储（按用户要求） | ✅ |  |
| 业务逻辑/UI 渲染 |  | M1 / M4 |
| LLM 请求 |  | M3 |
| 内容提取 |  | M2 |

---

## 3. 数据库 Schema（Dexie.js）

### 3.1 表结构

```ts
// modules/storage/db.ts
import Dexie from 'dexie';

export class AiReaderDB extends Dexie {
  conversations!: Dexie.Table<ConversationRecord, string>;
  messages!: Dexie.Table<MessageRecord, string>;
  rssItems!: Dexie.Table<RssItemRecord, string>;
  rssFeeds!: Dexie.Table<RssFeedRecord, string>;

  constructor() {
    super('AiReaderDB');
    this.version(1).stores({
      conversations: 'id, updatedAt, title, mode',
      messages: 'id, conversationId, parentId, createdAt',
      rssItems: 'id, feedId, pubDate, isRead, hash',
      rssFeeds: 'id, url, enabled, lastFetchedAt',
    });
  }
}
```

### 3.2 主表：Conversations

```ts
export interface ConversationRecord {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  mode: 'chat' | 'roundtable' | 'relay';
  activeProviderIds: string[];
  /** 消息数量（不存内容） */
  messageCount: number;
  /** 首条消息摘要，用于列表预览 */
  preview: string;
  /** 根消息 ID */
  rootMessageId: string;
}
```

### 3.3 副表：Messages

```ts
export interface MessageRecord {
  id: string;
  conversationId: string;
  parentId: string | null;
  role: 'user' | 'assistant';
  /** 用户消息内容（通常较短） */
  content?: string;
  /** 多模型完整回复 JSON（可能极大） */
  modelResponses: ModelResponse[];
  createdAt: number;
}
```

### 3.4 懒加载原则

- **历史列表页**只查询 `Conversations` 主表。
- **进入阅读模式**时，按 `conversationId` 查询 `Messages` 副表。
- 单条 Message 的 `modelResponses` 可能包含百万 Token 文本；UI 层按需渲染，不一次性全部挂载到 DOM。

---

## 4. Pinia 持久化与跨入口同步

### 4.1 Store 分层

```ts
// stores/index.ts
export const useUiStore = defineStore('ui', () => { /* UIState */ });
export const useContextStore = defineStore('context', () => { /* currentContext */ });
export const useSettingsStore = defineStore('settings', () => { /* ProviderConfig, prompts */ });
export const useConversationStore = defineStore('conversation', () => { /* 当前会话 */ });
```

### 4.2 持久化策略

- `ui`、`context`、`settings` 等小型状态使用 `pinia-plugin-persistedstate`，序列化到 `chrome.storage.local`。
- 大型对话数据不通过 Pinia 持久化，直接写入 Dexie。

### 4.3 跨入口同步

```ts
// stores/sync.ts
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  // 当其他入口修改 storage 时，刷新当前 Pinia store
  for (const [key, { newValue }] of Object.entries(changes)) {
    hydrateStore(key, newValue);
  }
});
```

---

## 5. 历史记录虚拟滚动

### 5.1 数据源

- 使用 `vue-virtual-scroller` 的 `RecycleScroller`。
- 列表数据源为 `Conversations` 主表按 `updatedAt` 倒序查询。
- 视口内只渲染约 20 个 DOM 节点。

### 5.2 列表项组件

```vue
<!-- components/history/HistoryList.vue -->
<RecycleScroller
  class="history-list"
  :items="conversations"
  :item-size="64"
  key-field="id"
>
  <template #default="{ item }">
    <HistoryItem :conversation="item" />
  </template>
</RecycleScroller>
```

### 5.3 搜索过滤

- 关键词搜索先在 `Conversations` 表的 `title` 和 `preview` 字段上快速过滤。
- 需要全文检索时，调用 Web Worker 异步查询 `Messages` 表。

---

## 6. Web Worker 全文检索

### 6.1 Worker 实现

```ts
// modules/storage/search.worker.ts
self.onmessage = async (event) => {
  const { query, messages } = event.data;
  const results = [];

  for (const msg of messages) {
    const text = extractSearchableText(msg);
    const index = text.toLowerCase().indexOf(query.toLowerCase());
    if (index !== -1) {
      const snippet = extractSnippet(text, index, 120);
      results.push({ messageId: msg.id, conversationId: msg.conversationId, snippet });
    }
  }

  self.postMessage({ results });
};
```

### 6.2 检索流程

1. UI 输入关键词，Debounced 300ms。
2. 主线程从 Dexie 分批读取 `Messages`（例如每次 500 条）。
3. 将批次发送到 Worker 进行匹配。
4. Worker 返回摘要高亮切片，UI 渲染结果列表。

### 6.3 性能约束

- 严禁在主线程对上万条长文本执行正则匹配。
- Worker 内可并行使用多个 Worker 实例（分片查询）。

---

## 7. API Key 与设置存储

### 7.1 明文存储（按用户要求）

- Provider 的 `apiKey` 与 `baseUrl` 等敏感配置以明文保存在 `chrome.storage.local`。
- 在 UI 中明确提示风险：「API Key 以明文存储在本地浏览器，请勿在公共/共享设备使用。」
- 二期可无痛升级为加密存储，只需替换 M7 的 `settingsStore` 序列化层。

### 7.2 设置结构

```ts
export interface Settings {
  providers: ProviderConfig[];
  prompts: PromptTemplate[];
  exportConfig: ExportConfig;
  rssConfig: RssConfig;
  ui: {
    theme: 'light' | 'dark';
    sidebarWidth: number;
  };
}
```

---

## 8. 大文本分片缓存

### 8.1 场景

- M2 提取的百万 Token 文本需要通过 Background 传输到 Side Panel。
- 传输过程中使用分片，M7 提供临时缓存接口。

### 8.2 缓存接口

```ts
// modules/storage/chunk-cache.ts
export interface ChunkCacheAPI {
  setTransferMeta(id: string, meta: { totalChunks: number; totalSize: number }): Promise<void>;
  setChunk(id: string, index: number, data: string): Promise<void>;
  getAllChunks(id: string): Promise<string[]>;
  clearTransfer(id: string): Promise<void>;
}
```

### 8.3 实现

- 使用 `chrome.storage.session` 或 IndexedDB 临时表存储分片。
- 完成组装后清理分片，避免占用空间。

---

## 9. 组件与服务拆分

```
modules/storage/
├── index.ts              # 对外暴露 db、search、cache API
├── db.ts                 # Dexie 初始化与 schema
├── types.ts              # 存储层数据类型
├── repositories/
│   ├── conversation.repo.ts
│   └── message.repo.ts
├── persisted-state.ts    # Pinia + chrome.storage 同步
├── search.worker.ts      # 全文检索 Worker
├── chunk-cache.ts        # 大文本分片缓存
└── migrations/           # 数据库迁移脚本
```

---

## 10. 错误处理

| 错误场景 | 处理策略 |
|---|---|
| IndexedDB 空间不足 | 提示用户清理历史，优先保留最近 30 天 |
| 主副表数据不一致 | 启动时运行一致性检查，缺失副表数据时标记会话损坏 |
| 虚拟滚动白屏 | 兜底为传统分页列表 |
| Worker 检索失败 | 降级为标题搜索 |
| Storage 同步冲突 | 以最后写入时间为准，必要时提示用户 |

---

## 11. 测试策略

- **单元测试**：
  - Dexie 增删改查与索引命中。
  - Pinia 持久化 Hydrate 流程。
  - 分片缓存组装正确性。
- **集成测试**：
  - 模拟 10,000 条 Conversation 验证虚拟滚动性能。
  - 100MB 长文本写入/读取/删除。
- **压力测试**：
  - Worker 全文检索 10K 条长消息耗时。

---

## 12. 依赖契约

| 依赖模块 | 契约 |
|---|---|
| M1 Entry & Layout | 提供 `uiState`、`currentContext` 读取与写入 |
| M2 Context Extraction | 接收 `ExtractedContext` 并写入 `currentContext` |
| M3 Provider & LLM Client | 提供 `ProviderConfig` 读取；API Key 明文存储 |
| M4 Chat Workspace | 提供 Conversation/Message 读写接口 |
| M5 Advanced Workflows | 提供 WorkflowSession/Template 存储接口 |
| M6 Export & Sync | 提供全量导出数据读取 |
| M8 RSS Pipeline | 提供 RssFeed/RssItem 存储接口 |
