# M8 后台 RSS 自动化流水线 — Vibe Coding 任务清单

> **目标**：在 Background Service Worker 中实现 RSS 定时抓取、去重、AI 摘要与 badge 更新。
> **输入**：`doc/1.md` 模块 5、`doc/design-08-rss-pipeline.md`
> **建议执行顺序**：M3、M7 完成后开始；可独立运行。

---

## 1. 依赖安装与数据模型

- [ ] 安装 `fast-xml-parser`（或其他轻量 RSS 解析器）
- [ ] 创建 `modules/rss/` 目录
- [ ] 定义 `RssFeed`、`RssItem` 类型
- [ ] 在 M7 中保存 `RssFeed` 与 `RssItem`（或复用 M7 的 rss 表）
- [ ] 在 Options 中增加 RSS 订阅源管理 UI（URL、标题、间隔、开关）

---

## 2. RSS 抓取与解析

- [ ] 实现 `modules/rss/fetcher.ts`
- [ ] 使用 `fetch` 获取 RSS XML，设置 30s 超时
- [ ] 解析 RSS 2.0、Atom、JSON Feed
- [ ] 提取 `title`、`link`、`pubDate`、`content`/`description`
- [ ] 用 3 个真实 RSS 源测试解析正确性

---

## 3. 哈希去重

- [ ] 实现 `modules/rss/dedup.ts`
- [ ] 计算 `hash = hashString(feedId + title + link)`
- [ ] 查询 `rssItems` 表，已存在 hash 则跳过
- [ ] 新条目写入 `rssItems`，标记 `isRead = false`
- [ ] 验证同一源不重复写入

---

## 4. 定时轮询调度

- [ ] 实现 `modules/rss/scheduler.ts`
- [ ] 使用 `chrome.alarms.create(`rss:${feedId}`, { periodInMinutes })`
- [ ] 默认间隔 360 分钟（6 小时）
- [ ] 用户添加/删除/修改源时重建 alarms
- [ ] 用 `chrome.alarms.getAll()` 验证 schedule 正确

---

## 5. AI 摘要生成（可选开关）

- [ ] 实现 `modules/rss/summarizer.ts`
- [ ] 默认关闭，用户明确开启后才调用 LLM
- [ ] 使用轻量模型（如 `gpt-4o-mini` 或用户指定低成本 Provider）
- [ ] Prompt：「请用 3 句话总结这篇文章的核心观点。」
- [ ] 串行队列处理摘要，避免并发费用飙升
- [ ] 摘要失败时标记 `isSummarized = false`，不影响条目保存

---

## 6. Badge 更新

- [ ] 实现 `modules/rss/badge.ts`
- [ ] 查询 `rssItems` 表中 `isRead = false` 的数量
- [ ] 使用 `chrome.action.setBadgeText` 设置未读数（最大显示 99）
- [ ] 全部已读后清空 badge
- [ ] 测试 badge 随新条目到达正确变化

---

## 7. RSS 信息流 UI

- [ ] 在 Side Panel 中增加 RSS 信息 Tab（M1 提供容器）
- [ ] 实现 `RssFeedList.vue` 与 `RssItemList.vue`
- [ ] 列表项显示：标题、来源、时间、AI 摘要（如有）、未读圆点
- [ ] 点击条目在新标签页打开原文，并标记 `isRead = true`
- [ ] 支持「全部标为已读」

---

## 8. 错误处理与监控

- [ ] 抓取失败时记录 `feed.lastError`（code、message、时间）
- [ ] 单个源失败不影响其他源
- [ ] Options 中展示每个源最后一次错误信息
- [ ] 实现「立即重试」按钮

---

## 验收标准

1. 添加 3 个真实 RSS 源后，background 能定时抓取并写入新条目。
2. 同一篇文章重复抓取时不产生重复 `RssItem`。
3. 未读数正确显示在扩展图标 badge 上。
4. 关闭摘要开关时，新增条目不产生任何 LLM API 费用。

---

## 依赖提醒

- **阻塞项**：M3（摘要调用）、M7（RssFeed/RssItem 存储）。
- **后续接入**：M1 的 Side Panel 提供 RSS 信息流展示容器。
