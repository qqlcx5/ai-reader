# M7 存储与数据（Storage & Data）详细设计

> **版本**：v1.1
> **对应 PRD**：v3.2 第三章「技术选型矩阵」、第四章「长文本渲染避坑点」
> **设计原则**：存储层统一管理所有持久化数据，各级缓存命中/淘汰策略内置于此模块；上层模块不直接操作 IndexedDB / localStorage，通过此模块暴露的接口读写。

---

## Coverage Status

> 基于 `/reference/nextai-translator` 与 `/reference/obsidian-clipper` 源码分析。

| 需求项 | 覆盖状态 | 参考实现 | 备注 |
|--------|---------|---------|------|
| Dexie.js 主副表分离 | **已覆盖** | nextai-translator | `database.ts` 中 Dexie 表定义与索引 |
| Pinia 响应式持久化 | **已覆盖** | nextai-translator | `pinia-plugin-persistedstate` 将 UI 状态存 `localStorage` |
| 虚拟滚动（virtual-scroller） | **未覆盖** | — | 两个项目均无长列表渲染 |
| Web Worker 全文检索 | **未覆盖** | — | 型定义与索引建立 |
| rAF 节流优化 | **部分覆盖** | obsidian-clipper | `reader.ts` 使用 `requestAnimationFrame` |
| memoizeWithExpiration 缓存 | **部分覆盖** | obsidian-clipper | `memoizeWithExpiration()` 在 `template-compiler.ts` 使用 |
| 智能缓存策略（L1/L2/L3） | **未覆盖** | Cherry Studio | 三级缓存架构需新建 |

**综合评估**：Dexie 使用模式有直接参考。虚拟滚动、全文检索、智能缓存策略为新开发。

**优先级建议**：P2 — 存储层是所有模块的基础，Dexie 主副表结构早期定好。

---

## 1. 设计目标

- 所有持久化数据的统一存储层：对话历史、Provider 配置、提取上下文、API 缓存、高亮数据。
- 主副表分离：避免大体积主表拖慢 UI 渲染。
- 轻量 UI 状态走 `pinia-plugin-persistedstate` + `localStorage`。
- 长消息列表采用虚拟滚动，确保对话历史超 10K 条消息时滚动帧率 ≥ 45fps。
- 后台 Web Worker 全文检索，不阻塞主线程。
- 实现三级智能缓存：L1 内存 / L2 IndexedDB / L3 API 响应，减少重复提取和重复 API 调用。

---

## 2. 职责边界

| 职责 | 属于本模块 | 不属于本模块 |
|---|---|---|
| Dexie 数据库 schema 与 DAO | ✅ |  |
| Pinia 持久化配置 | ✅ |  |
| 虚拟滚动组件 | ✅ |  |
| Web Worker 全文检索 | ✅ |  |
| 智能缓存（L1/L2/L3） | ✅ |  |
| Provider 请求实现 |  | M3 |
| 导出/同步 |  | M6 |
| LLM 调用 |  | M3 |

---

## 3. 核心数据结构

### 3.1 Dexie Schema（主副表分离）

```ts
// modules/storage/db.ts
import Dexie from 'dexie';

export class AiReaderDB extends Dexie {
  /** 主表：对话元数据（轻量，UI 频繁读取） */
  conversations!: Dexie.Table<Conversation, string>;
  /** 主表：消息摘要（轻量，不含完整 content） */
  messagesSummary!: Dexie.Table<MessageSummary, string>;
  /** 副表：消息完整内容（大体积，懒加载） */
  messageContents!: Dexie.Table<MessageContent, string>;
  /** 副表：提取上下文（页面正文、元数据） */
  extractedContexts!: Dexie.Table<ExtractedContext, string>;
  /** 副表：API 响应缓存（大体积，LRU） */
  apiResponseCache!: Dexie.Table<ApiCacheEntry, string>;
  /** 设置：Provider 配置、模板、用户偏好 */
  settings!: Dexie.Table<SettingsEntry, string>;
  /** 高亮数据 */
  highlights!: Dexie.Table<HighlightData, string>;
  /** 资产备份：MHTML 快照 */
  mhtmlSnapshots!: Dexie.Table<MhtmlSnapshot, string>;

  constructor() {
    super('AiReaderDB');
    this.version(1).stores({
      conversations: '&id, createdAt, updatedAt',
      messagesSummary: '&id, conversationId, createdAt',
      messageContents: '&id',
      extractedContexts: '&url, extractedAt',
      apiResponseCache: '&cacheKey, createdAt',
      settings: '&key',
      highlights: '&id, domain, pageUrl',
      mhtmlSnapshots: '&id, url',
    });
  }
}
```

### 3.2 主副表映射

```ts
export interface MessageSummary {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  /** 只保存前 200 字符用于预览 */
  preview: string;
  modelCount: number;
  createdAt: number;
}

export interface MessageContent {
  id: string;  // = MessageSummary.id
  /** 完整 content（可能 100K+） */
  content: string;
  modelResponses: ModelResponse[];
}
```

---

## 4. 智能缓存策略（L1 / L2 / L3）

借鉴 Cherry Studio 多级缓存架构，减少重复 API 调用，提升响应速度并降低 Token 消耗。

### 4.1 缓存层级

| 级别 | 存储介质 | 生命周期 | 缓存内容 | 淘汰策略 | 容量 |
|------|----------|----------|----------|----------|------|
| **L1 内存缓存** | `Map<string, CachedItem>` | 页面/closing | 最近 N 次提取结果 + 最近 API 响应 | LRU（最多 10 条） | — |
| **L2 持久化缓存** | IndexedDB `extractedContexts` | TTL 24h 可配 | 按 URL 索引的提取结果与结构化元数据 | 过期刷新 + 容量上限 500MB | 500MB |
| **L3 API 响应缓存** | IndexedDB `apiResponseCache` | 按内容哈希永不过期 | Query + URL + content_hash 为 Key 的 API 响应 | 手动清理 + 容量上限 200MB | 200MB |

### 4.2 L1 内存缓存实现

```ts
// modules/storage/cache/l1-memory.ts
class L1MemoryCache {
  private cache = new Map<string, { data: unknown; timestamp: number }>();
  private maxSize = 10;

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (entry) {
      // 访问时移到 LRU 尾部
      this.cache.delete(key);
      this.cache.set(key, entry);
      return entry.data as T;
    }
    return null;
  }

  set(key: string, data: unknown): void {
    if (this.cache.size >= this.maxSize) {
      // 淘汰最早项
      const first = this.cache.keys().next().value;
      this.cache.delete(first);
    }
    this.cache.set(key, { data, timestamp: Date.now() });
  }
}
```

### 4.3 L2 持久化缓存

- Key：`url`（页面完整 URL）。
- 内容：`ExtractedContext`（含 `content` + `metadata`）。
- TTL：默认 24h，在 Options 中可调。
- 命中时跳过 defuddle 提取（节省 2~8s）。
- 过期后触发后台静默刷新。

### 4.4 L3 API 响应缓存

- Key：`hash(query + url + content_hash)` — 确保相同输入精确命中。
- 内容：完整 API 响应流。
- 永不过期，由用户手动清理。
- 适用于频繁切换模型对比同一问题的场景。
- 命中时 M4 底栏标注 `⚡ Cached`。

---

## 5. Pinia UI 状态持久化

```ts
// modules/storage/pinia-plugin.ts
import { createPersistedState } from 'pinia-plugin-persistedstate';

const pinia = createPinia();
pinia.use(
  createPersistedState({
    storage: localStorage, // 仅轻量 UI 状态
    key: (id) => `ai_reader_ui_${id}`,
  })
);
```

**持久化的状态**：
- 当前侧边栏模式（Side Panel / Popup）
- 最后活动 Tab
- UI 偏好（字体大小、暗色模式、侧边栏宽度）
- 模型选择器上次勾选状态

**不持久化的状态**：
- 流式渲染中的部分 delta
- AbortController 列表
- 临时 UI toast

---

## 6. 虚拟滚动

### 6.1 选型

- 使用 `virtual-scroller` (类似 `vue-virtual-scroller`)。
- 对话历史超 100 条消息时激活。
- 节点回收距离：视口 ± 2 屏。

### 6.2 实现要点

```vue
<template>
  <virtual-scroller
    :items="messageList"
    :item-height="dynamicItemHeight"
    :buffer="screenHeight * 2"
  >
    <template #default="{ item }">
      <UserMessage v-if="item.role === 'user'" :message="item" />
      <ModelCard v-else :message="item" />
    </template>
  </virtual-scroller>
</template>
```

- 消息高度动态计算（文本 + 代码块 + 模型卡片），通过 `ResizeObserver` 实时更新。
- 上限 50K 条消息（Dexie 游标分页 + 虚拟滚动联合优化）。

---

## 7. Web Worker 全文检索

### 7.1 架构

```
Main Thread (UI)
    │
    ├─► postMessage({ type: 'SEARCH', query: '...' })
    │
    ▼
Web Worker
    ├─ Fuse.js / MiniSearch 索引
    ├─ 从 IndexedDB 加载文档
    └─► postMessage({ type: 'RESULTS', hits: [...] })
```

### 7.2 索引建立

- Worker 加载时，从 `messageContents` 表全量读取建立索引。
- 新消息通过 `postMessage` 增量更新索引。
- 索引结果返回 `messageId[]`，UI 通过 ID 从主表渲染预览。

### 7.3 Worker 脚本

```ts
// workers/search.worker.ts
import MiniSearch from 'minisearch';

const searchIndex = new MiniSearch({
  fields: ['content'],
  storeFields: ['messageId'],
});

self.onmessage = (e) => {
  switch (e.data.type) {
    case 'INDEX':
      searchIndex.addAll(e.data.documents);
      break;
    case 'SEARCH':
      const results = searchIndex.search(e.data.query, { fuzzy: 0.2 });
      self.postMessage({ type: 'RESULTS', hits: results });
      break;
    case 'ADD':
      searchIndex.add(e.data.document);
      break;
  }
};
```

---

## 8. 性能优化

### 8.1 rAF 节流

借鉴 obsidian-clipper 的 `reader.ts` 中使用 `requestAnimationFrame` 做滚动动画的模式：M7 虚拟滚动组件内置 rAF 节流，确保高频滚动事件不引起过度重渲染。

### 8.2 memoizeWithExpiration

借鉴 obsidian-clipper 的 `memoizeWithExpiration()` 函数，对以下高频调用做短期缓存：

```ts
// modules/storage/memoize.ts
export function memoizeWithExpiration<T>(
  fn: (...args: unknown[]) => T,
  ttlMs = 5000,
  keyFn?: (...args: unknown[]) => string
): (...args: unknown[]) => T {
  const cache = new Map<string, { value: T; expiresAt: number }>();

  return (...args: unknown[]) => {
    const key = keyFn ? keyFn(...args) : JSON.stringify(args);
    const cached = cache.get(key);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.value;
    }
    const value = fn(...args);
    cache.set(key, { value, expiresAt: Date.now() + ttlMs });
    return value;
  };
}
```

使用场景：
- 模板编译缓存（URL 敏感 Key，5s 过期）
- 对话历史查询（conversationId 敏感 Key）
- 频繁读取的 Provider 配置

### 8.3 批量写入

- 多条消息连续 `add` 时，采用 `db.transaction('rw', ..., () => {...})` 批量写入。
- 限制单次事务写入量 < 1000 条，超出分批处理。

---

## 9. 组件与服务拆分

```
modules/storage/
├── index.ts              # 对外暴露 DAO + cache 接口
├── db.ts                 # Dexie 数据库定义与初始化
├── dao/
│   ├── conversations.ts  # 对话 CRUD
│   ├── messages.ts       # 消息 CRUD（主副表）
│   └── settings.ts       # 设置 CRUD
├── pinia-plugin.ts       # Pinia 持久化配置
├── cache/
│   ├── l1-memory.ts      # L1 内存缓存（LRU）
│   ├── l2-persistent.ts  # L2 IndexedDB 页面缓存
│   └── l3-api.ts         # L3 API 响应缓存
├── memoize.ts            # memoizeWithExpiration 工具
└── workers/
    └── search.worker.ts  # Web Worker 全文检索
```

---

## 10. 测试策略

- **单元测试**：
  - Dexie schema 迁移与 CRUD 操作（fake-indexeddb mock）。
  - L1/L2/L3 缓存命中/过期/淘汰。
  - memoizeWithExpiration 过期与命中。
  - 虚拟滚动回收与渲染。
- **集成测试**：
  - Pinia 持久化 round-trip。
  - Web Worker 索引建立与搜索延迟。
  - 批量写入事务完整性。
- **性能测试**：
  - 50K 消息虚拟滚动帧率。
  - 100MB 索引建立时间。
  - L2 缓存命中率统计。

---

## 11. 依赖契约

| 依赖模块 | 契约 |
|---|---|
| M4 Chat Workspace | 读写 Conversation / Message / ModelResponse；消费 L3 缓存 |
| M3 Provider Client | 读写 ProviderConfig 与 API Key |
| M2 Context Extraction | 读写 ExtractedContext；消费 L2 缓存 |
| M6 Export & Sync | 提供导出数据、settings 列表 |
| M5 Advanced Workflows | 读写 WorkflowSession / Template |
