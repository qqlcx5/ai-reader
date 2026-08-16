# AuraMind 架构

贡献者视角的系统地图。代码入口从这里的文件名出发。

```
entrypoints/
├── background.ts      后台：RSS 定时刷新、收件箱轮询、右键菜单、快捷键、
│                      待办动作队列（pendingAction）、徽标、消息路由
├── content.ts         内容脚本：页面提取（EXTRACT_PAGE）、YouTube 字幕挖掘、
│                      悬浮球、页内导航事件
├── sidepanel/         面板应用（Vue 3）：全部 UI
└── offscreen/         Chromium 专用 DOM 环境（后台解析 RSS/HTML）
```

## 数据层

- `db/schema.ts` — Dexie 表定义（版本 14）。`flashcards` 用 `sm2.dueAt` 点路径索引。
- `db/repositories/` — 每表一个 Repository，薄封装，无业务逻辑。
- `services/sync/sync.service.ts` — `TYPE_CONFIGS` 声明式定义同步数据集；按
  `updatedAt` 做三方合并（Remotely-Save 风格）。加新同步表 = 加一行 config。
- 设备本地数据（WebDAV/S3/Anki/转写配置、主题、复习日志）放 `kvMeta`，不参与同步。

## 捕获管线

```
任意入口（TopBar / WorkspaceHeader / ContextPanel / 右键 / 快捷键）
  → services/capture/smart-capture.ts  captureTab(tab) 分流：
      .pdf URL   → services/capture/pdf.ts      面板内 fetch + pdf.js（懒加载 chunk）
      arXiv URL  → 同上（优先官方 HTML 版）
      YouTube    → content.ts 挖 ytInitialPlayerResponse → 字幕轨
                   （平台令牌限制下自动回退普通抓取）
      其他       → requestExtract → content.ts → defuddle → Markdown
  → ExtractedPageData（统一形状：markdown + hash + 词数 + extractionMethod）
  → DocumentRepository.save（contentHash 为 id，天然去重；按 URL 合并）
  → 可选：services/tags/auto-tag.ts（AI 打标签，fire-and-forget）
  → 可选：services/ai-job/queue.ts enqueueForDocument（后台分析）
```

播客/音频：`types/feed.ts` 的 `enclosure` → FeedsView「转写音频」→
`services/transcribe/whisper.ts`（Whisper 兼容端点，≤25MB）→ 文档入库。

## 复习子系统

- `utils/sm2.ts` — 纯 SM-2 算法（经典 0-5 质量 + 四按钮映射）。
- `services/review/generate.ts` — AI 生成问答/挖空卡（`⟦N⟧` 无关，闪卡用
  JSON 数组协议；高亮优先作材料，按 front 去重）。
- `stores/review.store.ts` — 会话队列、评分落库、streak（kvMeta `review-log`）、
  每日新卡上限（`utils/review-stats.ts` 纯函数）。
- `services/review/badge.ts` — 图标角标；面板打分后 `REVIEW_QUEUE_CHANGED` 通知后台。
- 导出：`utils/anki-export.ts`（TSV）/ 导入：`utils/anki-import.ts` /
  直推：`services/anki/anki-connect.ts`（localhost:8765）。

## 翻译 / TTS / 组织

- `services/translate/translate.ts` — 段落级 `⟦N⟧` 标记对齐翻译，结果缓存于
  `DocumentEntity.translation`，随文档同步。
- `composables/useTts.ts` — Web Speech API，按句分块。
- `utils/wikilinks.ts` — `[[标题]]` 解析 + 图构建（正文与高亮笔记都是链接源）；
  `services/search/related.ts` — 字符二元组相似度（绕开 MiniSearch 的 CJK 分词）。

## 消息协议（background ↔ 面板 ↔ 内容脚本）

runtime.sendMessage 广播，`type` 字段路由。关键类型：
`EXTRACT_PAGE` / `EXTRACT_YOUTUBE` / `PAGE_EXTRACTED` / `YOUTUBE_TRANSCRIPT` /
`FLOATING_CAPTURE` / `CAPTURE_PAGE` / `OPEN_REVIEW` / `GET_PENDING_ACTION` /
`TRIGGER_FEED_REFRESH` / `TRIGGER_INBOX_POLL` / `REVIEW_QUEUE_CHANGED`。

面板未打开时的动作（右键/快捷键）经 `pendingAction` 暂存，面板挂载时
`GET_PENDING_ACTION` 领取——不要改成直接 sendMessage（会丢）。

## 跨浏览器

- Firefox：MV2 持久后台页自带 DOMParser → `services/offscreen/manager.ts`
  的 `sendToOffscreen` 在有 DOMParser 的环境本地直解，offscreen 仅
  Chromium MV3 使用。开侧栏用 `sidebarAction.open()` 回退。
- UnoCSS 扫描源码提取类名：**不要**在源码/测试里写 `[00:00]` 这类字面量
  （会被当成任意选择器生成非法 CSS 使构建崩溃），用动态拼接。

## 测试

Vitest + fake-indexeddb + jsdom。组件测试里 mock `@lucide/vue` 请用
`importOriginal` 全量透传（见 ContextPanel.test.ts），避免逐图标打地鼠。
lucide mock 的历史教训、Dexie 原生版本号 ×10（14→140）等坑都写在各自测试注释里。
