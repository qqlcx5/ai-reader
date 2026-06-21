---
AIGC:
    Label: "1"
    ContentProducer: 001191440300708461136T1XGW3
    ProduceID: d270bcd3df6a2cd27c2792fa9a0b45ef_040df38d6d8f11f18805525400d9a7a1
    ReservedCode1: CO3ata0l6yU53ON2XAk+2MbTNiuGHBdeliKSxrzUsTqvv7OwXFcvgmP5e1gDkdyUHrT3gB8w7qYWas6u2QkwzCiPVKh+MfRoYB2v1AXB1UDf/HWzUsajcN6wBLDCdXH+3Eo/rL+uQ1qqzgwngRcqicq0EehpCrv87yb6g8hmn391T4HQs0Ng/7ObrbE=
    ContentPropagator: 001191440300708461136T1XGW3
    PropagateID: d270bcd3df6a2cd27c2792fa9a0b45ef_040df38d6d8f11f18805525400d9a7a1
    ReservedCode2: CO3ata0l6yU53ON2XAk+2MbTNiuGHBdeliKSxrzUsTqvv7OwXFcvgmP5e1gDkdyUHrT3gB8w7qYWas6u2QkwzCiPVKh+MfRoYB2v1AXB1UDf/HWzUsajcN6wBLDCdXH+3Eo/rL+uQ1qqzgwngRcqicq0EehpCrv87yb6g8hmn391T4HQs0Ng/7ObrbE=
---

# 模块 08：后台 RSS 自动化流水线

> 对应设计文档：design-08-rss-pipeline.md

## 子任务清单

- [ ] 子任务 1：定义 `RssFeed` / `RssItem` / `AiSummaryResult` / `ArchiveRule` 核心数据类型，包含订阅源配置、条目处理状态、摘要结果、归档规则等子结构
- [ ] 子任务 2：实现 `fetcher.ts` RSS XML 抓取与解析：`fetch(feed.url)` 获取 XML，解析为标准 `RssItem[]`；配置 `chrome.alarms` 定时器，默认 30 分钟间隔（最小 15 分钟，适配 MV3 Service Worker 生命周期）
- [ ] 子任务 3：实现 `dedup.ts` 哈希去重：使用 `buildContentHash()` 对标题+链接+发布时间组合哈希，新条目写入前查询 IndexedDB `contentHash` 索引，已存在则跳过
- [ ] 子任务 4：实现 `summarizer.ts` AI 预处理摘要：正文 > 500 字符时调用 M2 defuddle 提取正文；构建摘要 Prompt（3-5 句核心要点 + 新增信息 + 关键词标签）；调用 M3 `chatStream` 生成摘要；速率限制：单次批量最多 5 篇，批次间隔 10s
- [ ] 子任务 5：实现 `classifier.ts` 智能分类：按域名匹配 / 域名+路径前缀 / Schema.org 类型（`@Article`/`@Recipe`）/ URL 正则 四个维度匹配归档规则，自动选择对应归档模板
- [ ] 子任务 6：实现智能分类规则预设：`github.com` → 技术/GitHub/；`arxiv.org/abs/` → 论文/Arxiv/；`@Article` → 阅读/文章/；`@Recipe` → 生活/食谱/；`*.github.com/*/releases/*` → 技术/Release Notes/
- [ ] 子任务 7：实现 `archiver.ts` 归档写入：摘要生成后调用 M6 Obsidian URI 直写接口，写入目标 `<vault>/RSS/<分类文件夹>/<发布日期>_<标题>.md`；归档模板使用 M4 模板变量系统，含 YAML Frontmatter + AI 摘要 + 原文
- [ ] 子任务 8：实现递归日报模式：每日同一源的多篇文章合并为单篇日报笔记
- [ ] 子任务 9：实现 `pipeline.ts` 完整流水线编排：chrome.alarms 定时器 → RSS 抓取 → 哈希去重 → 正文提取 M2 → AI 摘要 M3 → 智能分类 → Obsidian URI 归档 M6 → Badge 更新
- [ ] 子任务 10：实现 `badge.ts` 扩展图标 Badge：未读数 = status `new` + `extracting` + `summarizing`；新文章数 = 最近一次用户查看后的新条目；橙色 badge（`#FF5722`）有新文章，蓝色 badge（`#1565C0`）仅未读；点击扩展图标进入 Side Panel 时清除 badge
- [ ] 子任务 11：实现 `RssManager.vue` 订阅源管理 UI（Options 页面中）：添加/删除/编辑 RSS 源、导入 OPML、显示各源上次抓取时间/条目数/错误状态、配置归档规则（选择模板和分类文件夹）
- [ ] 子任务 12：实现 `background.ts` Service Worker 入口：注册 chrome.alarms 定时器、监听 alarm 事件触发抓取、管理流水线生命周期（start/stop/fetchAll）
- [ ] 子任务 13：编写 RSS XML 解析单元测试（mock XML）、去重哈希碰撞测试、摘要 Prompt 模板填充测试、智能分类规则匹配测试、完整流水线集成测试（mock fetch）、badge 更新与清除测试
*（内容由AI生成，仅供参考）*
