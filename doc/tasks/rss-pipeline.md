# M8 后台 RSS 自动化流水线 — Vibe Coding 任务清单

> **目标**：在 Background Service Worker 中实现 RSS 定时抓取、去重、AI 摘要与 badge 更新。
> **输入**：`doc/1.md` 模块 5、`doc/design-08-rss-pipeline.md`
> **建议执行顺序**：M3、M7 完成后开始；可独立运行。

## 收尾记录

> 主 Agent 在 2026-06-21 完成 M8 收尾：
> - 核心实现位于 `lib/rss/`（types / fetcher / dedup / scheduler / summarizer / badge / pipeline）
> - `pnpm test` 23/23 通过、`pnpm compile` 0 错误、`pnpm build` 成功
> - RSS UI（Tab、FeedList、ItemList）属于二期，依赖 M1 Side Panel 容器
> - Options RSS 管理 UI 属于二期

---

## 1. 依赖安装与数据模型

- [x] RSS 解析无外部依赖（使用浏览器原生 DOMParser + JSON.parse）
- [x] 创建 `lib/rss/` 目录（与 M4/M5/M6 一致，避免 WXT 0.20 modules/ 冲突）
- [x] 定义 `ParsedItem`、`FetchResult`、`DedupInput`、`SummarizerOptions`、`SummaryJob`、`BadgeStats` 类型
- [x] 复用 M7 的 `RssFeedRecord` / `RssItemRecord` 存储类型
- [ ] 在 Options 中增加 RSS 订阅源管理 UI（二期，需 M1 容器）

---

## 2. RSS 抓取与解析

- [x] 实现 `lib/rss/fetcher.ts`
- [x] 使用 `fetch` 获取 RSS XML，设置 30s 超时
- [x] 解析 RSS 2.0（DOMParser）、Atom（DOMParser）、JSON Feed（JSON.parse）
- [x] 提取 `title`、`link`、`pubDate`、`content`/`description`
- [x] 单元测试覆盖 3 种格式 + HTTP 错误 + 超时 + 解析失败（7 个测试）

---

## 3. 哈希去重

- [x] 实现 `lib/rss/dedup.ts`
- [x] 计算 `hash = fnv1a32(feedId + title + link)`（FNV-1a 32-bit）
- [x] `filterNewItems()` 过滤已存在 hash 的条目
- [x] Pipeline 中查询 `rssItems` 表已有 hash，仅写入新条目
- [x] 单元测试覆盖一致性、不同输入、空值（7 个测试）

---

## 4. 定时轮询调度

- [x] 实现 `lib/rss/scheduler.ts`
- [x] 使用 `browser.alarms.create('rss:<feedId>', { periodInMinutes })`
- [x] 默认间隔 360 分钟（6 小时），最小 1 分钟
- [x] 用户添加/删除/修改源时调用 `scheduleAllFeeds()` 重建 alarms
- [x] 单元测试覆盖默认间隔、自定义间隔、跳过 disabled、最小间隔（4 个测试）

---

## 5. AI 摘要生成（可选开关）

- [x] 实现 `lib/rss/summarizer.ts`
- [x] 默认关闭（`summarizerOptions.enabled = false`）
- [x] 使用轻量模型（默认 `gpt-4o-mini` 或用户指定 Provider）
- [x] Prompt：「请用 3 句话总结这篇文章的核心观点。」
- [x] 串行队列 `summarizeBatch()` 处理摘要，避免并发费用飙升
- [x] 摘要失败时返回 null，Pipeline 中标记 `isSummarized = false`

---

## 6. Badge 更新

- [x] 实现 `lib/rss/badge.ts`
- [x] 查询 `rssItems` 表中 `isRead = false` 的数量
- [x] 使用 `browser.action.setBadgeText` 设置未读数（最大 99+）
- [x] 全部已读后清空 badge
- [x] 单元测试覆盖（3 个测试）

---

## 7. Pipeline 编排

- [x] 实现 `lib/rss/pipeline.ts`
- [x] 完整流程：fetch → dedup → summarize → store → badge
- [x] 单个源失败不影响其他源（每个 feed 独立运行）
- [x] 抓取失败时记录 `feed.lastError`（code、message、at timestamp）

---

## 8. RSS 信息流 UI（二期）

- [ ] 在 Side Panel 中增加 RSS 信息 Tab（M1 提供容器）
- [ ] 实现 `RssFeedList.vue` 与 `RssItemList.vue`
- [ ] 列表项显示：标题、来源、时间、AI 摘要（如有）、未读圆点
- [ ] 点击条目在新标签页打开原文，并标记 `isRead = true`
- [ ] 支持「全部标为已读」

---

## 9. 错误处理与监控 UI（二期）

- [ ] Options 中展示每个源最后一次错误信息
- [ ] 实现「立即重试」按钮

---

## 验收标准

1. ✅ 后台 pipeline 能定时抓取并写入新条目（fetcher + pipeline 测试通过）。
2. ✅ 同一篇文章重复抓取时不产生重复 `RssItem`（dedup 测试通过）。
3. ✅ 未读数正确显示在扩展图标 badge 上（badge 测试通过）。
4. ✅ 关闭摘要开关时，新增条目不产生任何 LLM API 费用（enabled: false 默认）。
5. ⚠️ 信息流 UI 展示（二期，需 M1 Side Panel 容器）。

---

## 依赖提醒

- **阻塞项**：M3（摘要调用）、M7（RssFeed/RssItem 存储）。 ✅ 已完成
- **后续接入**：M1 的 Side Panel 提供 RSS 信息流展示容器。 （二期）
