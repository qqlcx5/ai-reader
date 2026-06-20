# M8 后台 RSS 自动化流水线（RSS Pipeline）详细设计

> **版本**：v1.0
> **对应 PRD**：第二章「模块 5：后台 RSS 自动化流水线」
> **设计原则**：RSS 流水线在 Background Service Worker 中独立运行，周期性拉取、去重、摘要；与主 UI 通过 M7 交换数据。

---

## 1. 设计目标

- 在 Background Service Worker 中静默增量抓取 RSS 源。
- 使用哈希对比去重，避免重复处理。
- 调用轻量 LLM 生成 3 句核心摘要（用户可关闭，避免意外扣费）。
- 在扩展图标显示未读数 badge。
- 在 Side Panel 中展示 RSS 信息流。

---

## 2. 职责边界

| 职责 | 属于本模块 | 不属于本模块 |
|---|---|---|
| RSS 源管理与轮询 | ✅ |  |
| 抓取与解析 | ✅ |  |
| 哈希去重 | ✅ |  |
| AI 摘要生成 | ✅ |  |
| Badge 更新 | ✅ |  |
| UI 信息流展示 |  | M1 / M4 |
| LLM Provider 调用实现 |  | M3 |
| 数据持久化 |  | M7 |

---

## 3. 核心数据结构

### 3.1 RSS 源

```ts
// modules/rss/types.ts
export interface RssFeed {
  id: string;
  url: string;
  title: string;
  enabled: boolean;
  /** 轮询间隔（分钟），默认 360（6 小时） */
  intervalMinutes: number;
  lastFetchedAt: number | null;
  lastError?: { code: string; message: string; at: number };
}
```

### 3.2 RSS 条目

```ts
export interface RssItem {
  id: string;
  feedId: string;
  title: string;
  link: string;
  pubDate: number;
  /** 内容摘要或原文 */
  content?: string;
  /** 用于去重的稳定哈希 */
  hash: string;
  /** AI 生成的 3 句摘要 */
  aiSummary?: string;
  isRead: boolean;
  isSummarized: boolean;
  createdAt: number;
}
```

### 3.3 摘要请求

```ts
export interface SummaryRequest {
  itemId: string;
  title: string;
  content: string;
  providerId: string;
}
```

---

## 4. 后台调度

### 4.1 定时器

```ts
// modules/rss/scheduler.ts
export async function scheduleAllFeeds(feeds: RssFeed[]): Promise<void> {
  await chrome.alarms.clearAll();

  for (const feed of feeds) {
    if (!feed.enabled) continue;
    await chrome.alarms.create(`rss:${feed.id}`, {
      periodInMinutes: feed.intervalMinutes,
    });
  }
}
```

### 4.2 默认参数

- 默认最多 50 个 RSS 源。
- 默认轮询间隔：6 小时。
- 用户可逐源自定义间隔。

---

## 5. 抓取与解析

### 5.1 抓取

- 使用 `fetch(feed.url)` 获取 RSS XML。
- 设置 User-Agent 和合理超时（默认 30s）。
- 支持 RSS 2.0、Atom、JSON Feed。

### 5.2 解析

- 使用轻量 XML 解析器（如 `fast-xml-parser`）或自写最小化解析。
- 提取 `title`、`link`、`pubDate`、`content`/`description`。

### 5.3 去重

```ts
export function computeItemHash(item: RssItem): string {
  return hashString(`${item.feedId}:${item.title}:${item.link}`);
}
```

- 新条目与 `rssItems` 表中现有 `hash` 对比，重复则跳过。

---

## 6. AI 摘要生成

### 6.1 触发条件

- 用户开启「RSS 自动摘要」开关（默认关闭，避免意外扣费）。
- 每个新条目调用一次轻量模型（如 `gpt-4o-mini` 或用户指定的低成本模型）。
- 摘要 prompt：「请用 3 句话总结这篇文章的核心观点。」

### 6.2 流程

```ts
// modules/rss/summarizer.ts
export async function summarizeItem(
  item: RssItem,
  providerConfig: ProviderConfig
): Promise<string> {
  const provider = createProvider(providerConfig);
  let summary = '';

  await provider.chatStream(
    {
      providerId: providerConfig.id,
      messages: [
        {
          role: 'user',
          content: `请用 3 句话总结以下文章的核心观点：\n\n标题：${item.title}\n\n正文：${item.content?.slice(0, 8000) || ''}`,
        },
      ],
    },
    (event) => {
      if (event.type === 'delta') summary += event.content;
    }
  );

  return summary;
}
```

### 6.3 节流

- 后台摘要采用串行队列，避免并发请求过多。
- 单次请求设置 30s 超时，失败则标记 `isSummarized = false`。

---

## 7. Badge 更新

### 7.1 逻辑

```ts
// modules/rss/badge.ts
export async function updateBadge(): Promise<void> {
  const unreadCount = await db.rssItems
    .where('isRead')
    .equals(0)
    .count();

  await chrome.action.setBadgeText({
    text: unreadCount > 0 ? String(Math.min(unreadCount, 99)) : '',
  });
  await chrome.action.setBadgeBackgroundColor({ color: '#EF4444' });
}
```

---

## 8. 信息流 UI 数据契约

- RSS 信息流展示在 Side Panel 的一个独立 Tab 或面板中。
- 列表项显示：标题、来源、时间、AI 摘要（如有）、未读状态。
- 点击条目在新标签页打开原文，并标记 `isRead = true`。

---

## 9. 组件与服务拆分

```
modules/rss/
├── index.ts              # 对外暴露调度器与抓取入口
├── types.ts              # 数据类型
├── scheduler.ts          # chrome.alarms 管理
├── fetcher.ts            # RSS 抓取与解析
├── dedup.ts              # 哈希去重
├── summarizer.ts         # AI 摘要生成
├── badge.ts              # 扩展图标 badge 更新
└── __tests__/
    └── feed-samples/
```

---

## 10. 错误处理

| 错误场景 | 处理策略 |
|---|---|
| 源抓取失败 | 记录 `lastError`，下次继续尝试 |
| 解析失败 | 尝试备用解析器（如 feed 格式识别） |
| 摘要模型失败 | 标记 `isSummarized = false`，保留原文 |
| 用户未开启摘要 | 仅保存条目，不调用 LLM |
| 条目过多 | 超过 50 源或单源条目过多时提示用户 |

---

## 11. 测试策略

- **单元测试**：
  - RSS XML/Atom/JSON Feed 解析。
  - 哈希去重逻辑。
  - 调度器 alarm 创建与清理。
- **集成测试**：
  - 模拟 RSS 服务器抓取与摘要生成。
  - badge 更新正确性。
- **回归测试**：
  - 抓取失败不影响其他源。
  - 关闭摘要开关时不产生 LLM 费用。

---

## 12. 依赖契约

| 依赖模块 | 契约 |
|---|---|
| M3 Provider & LLM Client | 调用低成本模型生成摘要 |
| M7 Storage & Data | 保存 RssFeed、RssItem；读取未读数 |
| M1 Entry & Layout | 提供 Side Panel 中的 RSS 信息面板容器 |
| M4 Chat Workspace | 二期可支持「针对 RSS 条目提问」（可选） |
