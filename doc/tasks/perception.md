# 捕获层：网页解析与数据提取 (Perception)

## 目标
用户点击插件后，通过 defuddle 自动从任意网页提取正文 Markdown、元数据，并持久化到 IndexedDB。

## 最小可执行任务

### 1. Content Script 入口搭建
- [ ] 创建 `entrypoints/content.ts`（WXT content script entrypoint）
- [ ] 配置 `matches: ['<all_urls>']` 和 `world: 'MAIN'`（defuddle 需完整 DOM 访问）
- [ ] 注入悬浮捕获按钮（`CaptureButton.vue` 或纯 DOM 按钮）
- [ ] 绑定点击事件 → 触发捕获流程

### 2. defuddle 集成与正文提取
- [ ] 安装 `defuddle` 依赖
- [ ] 从 `defuddle/full` 导入 `createMarkdownContent()`
- [ ] 在 Content Script 中 `clone` 当前 `document` 并调用 `defuddle.parseAsync()`
- [ ] 获取 `markdownContent` 和元数据
- [ ] **降级处理**：defuddle 解析失败时回退到 `document.body.innerText` + 简单 Markdown 转换

### 3. 元数据自动提取
- [ ] 提取 `title`（`document.title`）
- [ ] 提取 `url`（`location.href`）
- [ ] 提取 `author`（meta / schema.org / JSON-LD）
- [ ] 提取 `publishedAt`（meta / schema.org）
- [ ] 提取 `favicon`（`document.querySelector('link[rel*="icon"]')?.href`）
- [ ] 提取 `description`（`meta[name="description"]`）
- [ ] 提取 `keywords`（`meta[name="keywords"]`）
- [ ] 提取 `siteName`（`og:site_name` 或域名）
- [ ] 提取 `image`（`og:image` 或首图）
- [ ] 提取 `wordCount`（Markdown 字数统计）
- [ ] 提取 `language`（`document.documentElement.lang` 或自动检测）
- [ ] 提取 `schemaOrgData`（页面内 JSON-LD / schema.org 脚本）

### 4. 捕获结果标准化
- [ ] 定义 `CapturedDocument` 接口（`core/documents/document.types.ts`）
- [ ] 生成唯一 `id`（`crypto.randomUUID()` 或 nanoid）
- [ ] 填充 `createdAt` / `updatedAt` 时间戳
- [ ] 组装完整 `CapturedDocument` 对象

### 5. 跨上下文通信
- [ ] Content Script 通过 `chrome.runtime.sendMessage` 发送 `CAPTURE_PAGE` 消息
- [ ] Background Service Worker 接收消息并转发到 Side Panel
- [ ] 定义消息类型（`shared/messaging/messages.ts`）

### 6. 持久化到 IndexedDB
- [ ] Background 调用 `documentRepository.put(document)`
- [ ] 写入 `documents` 表（Dexie）
- [ ] 返回 `documentId`

### 7. 通知搜索索引更新
- [ ] Background 通过 `postMessage` 通知 `search.worker.ts`
- [ ] Worker 执行 `MiniSearch.addDocument()` 增量更新

### 8. 打开 Side Panel 展示
- [ ] Background 调用 `chrome.sidePanel.open({ tabId })`
- [ ] Side Panel 接收 `documentId` 并读取文档
- [ ] UI 展示 Markdown 内容、元数据摘要、对话入口

---

## 验收标准
- [ ] 任意网页点击悬浮按钮后，3 秒内完成捕获并展示在 Side Panel
- [ ] 元数据提取完整度 ≥ 80%（主流新闻/博客/文档站点）
- [ ] 解析失败时有降级，不阻塞流程
- [ ] 捕获后搜索索引自动更新，可立即检索到

## 依赖模块
- `db/dexie.ts`（IndexedDB 表定义）
- `workers/search.worker.ts`（索引更新）
- `entrypoints/background.ts`（消息中转）
- `entrypoints/sidepanel/`（展示界面）
