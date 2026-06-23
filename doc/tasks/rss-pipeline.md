# M9 RSS 自动化流水线 — Vibe Coding 任务清单 (v1)

> **目标**：在 Service Worker 后台实现定时 RSS 拉取、哈希去重、AI 后台摘要生成、扩展 badge 未读计数，以及今日简报（Daily Briefing）功能。
> **输入**：`doc/proposal_v1.md` §2.7
> **依赖**：M3（Provider 客户端，用于 AI 摘要）、M8（存储层，RSSFeeds 表）

---

## 1. RSS 拉取器（Fetcher）

- [ ] 实现 `lib/rss/fetcher.ts`
  - `fetchFeed(url: string): Promise<RawFeedData>`
    - 通过 `fetch(url)` 获取 RSS / Atom XML
    - 使用 `DOMParser` 解析 XML（`application/xml`）
    - 支持 RSS 2.0 / Atom 1.0 两种格式
    - 提取字段：`title` / `link` / `description` / `pubDate` / `author`
    - 超时 10s（`AbortSignal.timeout(10000)`）
  - 返回 `RawFeedData { feedTitle, feedUrl, items: RawArticle[] }`

---

## 2. 哈希去重（Deduplication）

- [ ] 实现 `lib/rss/dedup.ts`
  - `computeArticleId(article: RawArticle): string`：`SHA-256(article.link)` → hex（与 M8 `RSSArticleRecord.id` 一致）
  - `filterNewArticles(fetched: RawArticle[], existing: Set<string>): RawArticle[]`
    - 比较 ID set，仅返回不在 `existing` 中的新文章
  - 对应 M8 `rss.repo.updateArticles` 在写入前调用此函数

---

## 3. AI 后台摘要生成（Summarizer）

- [ ] 实现 `lib/rss/summarizer.ts`
  - `summarizeArticle(article: RawArticle, engine: IEngine, apiKey: string): Promise<string>`
    - 构建 Prompt：`"请用 3 句话（不超过 200 字）概括以下文章内容：\n\n${article.description}"`
    - 调用 M3 `engine.chatStream()`，收集完整响应后返回摘要文本
    - 超时 30s，失败时返回 `article.description.slice(0, 200)` 降级摘要
  - **后台静默执行**：不弹出任何 UI，用户无感知
  - 批量处理：每个 Feed 新文章串行生成摘要（避免并发打爆 Rate Limit）

---

## 4. 定时调度器（Service Worker Alarm）

- [ ] 实现 `lib/rss/scheduler.ts`
  - `initAlarm(intervalMinutes = 30): void`
    - `chrome.alarms.create('rss-fetch', { periodInMinutes: intervalMinutes })`
  - `handleAlarm(alarmName: string): Promise<void>`
    - 仅处理 `'rss-fetch'` alarm
    - 从 M8 读取所有 `RSSFeedRecord`
    - 对每个 Feed 依次：`fetch → dedup → summarize → save`
  - 错误隔离：单个 Feed 失败不影响其他 Feed
- [ ] 在 `background.ts` 中：
  - `chrome.alarms.onAlarm.addListener(scheduler.handleAlarm)`
  - 扩展安装时调用 `initAlarm()`

---

## 5. 扩展 Badge 未读计数

- [ ] 实现 `lib/rss/badge.ts`
  - `updateBadge(): Promise<void>`
    - `count = await rssRepo.getUnreadCount()`
    - `chrome.action.setBadgeText({ text: count > 0 ? String(count) : '' })`
    - `chrome.action.setBadgeBackgroundColor({ color: '#5b60e5' })`（`obsidian-primary` 紫色）
  - 每次 Alarm 完成后调用 `updateBadge()`
  - 用户在 RSS 面板标记已读后调用 `updateBadge()`

---

## 6. RSS 面板 UI

- [ ] 实现 `components/rss/RSSPanel.vue`（接入 M1 右栏"RSS"Tab）
- [ ] 实现 `components/rss/FeedList.vue`
  - 已订阅 Feed 列表：Feed 标题 + favicon + 未读数 badge
  - 点击展开该 Feed 的文章列表
  - 右键 / 操作按钮：删除 Feed / 立即刷新
- [ ] 实现 `components/rss/ArticleItem.vue`
  - 未读态：左侧 4px 紫色边框条（`border-l-4 border-obsidian-primary`）
  - 已读态：`opacity-85`
  - 文章标题 + 未读 badge
  - AI 摘要区域：`bg-obsidian-bg` + `border` + `rounded-lg`，`text-[11px]`，3 句话展示
  - 底部：来源 + 时间（`dayjs` 相对时间）+ "以此开启对话"紫色软按钮
  - 点击"以此开启对话"：将文章 `description`（或全文）作为上下文，在 M4 Chat 中发起新对话
- [ ] 实现 `components/rss/AddFeedModal.vue`
  - 输入 RSS URL，【验证】按钮（`testConnection` 式校验：fetch + 解析前 3 条）
  - 验证成功后显示 Feed 标题预览
  - 【添加订阅】写入 M8

---

## 7. 今日简报（Daily Briefing）

- [ ] 实现 `lib/rss/daily-briefing.ts`
  - `generateBriefing(): Promise<string>`
    - 查询当天（`publishedAt > todayMidnight`）所有 RSS 文章的 AI 摘要
    - 按 Feed 分组，生成如下格式的 Markdown：
      ```markdown
      # 今日简报 — 2025-01-15

      ## 📰 The Verge（3 篇）
      - **文章标题**：AI 摘要内容...
      - ...

      ## 📰 36kr（5 篇）
      - **文章标题**：AI 摘要内容...
      ```
    - 底部附"共 X 篇新文章，来自 Y 个订阅源"
- [ ] 实现 `components/rss/DailyBriefingCard.vue`
  - 每日首次打开浏览器时展示（`chrome.storage.local` 记录 `lastBriefingDate`，与今日比较）
  - 卡片形式出现在 RSS Tab 顶部，可折叠
  - 【导出到 Obsidian】按钮（调用 M7 `obsidian.ts`）
  - 文章标题可点击：触发"以此开启对话"

---

## 8. Options RSS 管理 UI

- [ ] 在 Options 页 RSS Tab 中嵌入订阅源管理：
  - 已订阅源列表（Feed 标题 / URL / 拉取间隔 / 上次拉取时间）
  - 拉取间隔可编辑（下拉：15 / 30 / 60 / 120 分钟）
  - 删除订阅源（含确认 Modal）
  - AI 摘要模型选择（用哪个 Provider 生成摘要）

---

## 验收标准

1. 添加一个有效 RSS 源，Alarm 触发后（或手动触发）新文章出现在 RSS 面板，含 AI 3 句摘要。
2. 扩展图标 badge 显示未读数量，全部标为已读后 badge 消失。
3. 重复拉取同一 RSS 源，哈希去重正确：已存在文章不重复写入。
4. 点击"以此开启对话"，Side Panel 打开，InputComposer 预填文章摘要内容。
5. 今日简报：当天新文章 > 0 时，RSS Tab 顶部显示简报卡片，格式正确。
6. 单个 Feed 拉取 / 摘要失败时，其他 Feed 继续处理，错误写入 `console.error` 但不崩溃。
