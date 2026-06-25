# 捕获层：网页解析与数据提取 (Perception)

## 目标
用户点击插件后，通过 defuddle 自动从任意网页提取正文 Markdown、元数据，并持久化到 IndexedDB。

> ⚠️ **关键约束**：本任务文件已通过 [chrome-extensions] skill 技术评审（详见 `tech-review_2026-06-25.md`）
> 涉及规则：`world: 'MAIN'` 风险、`tab.url` 权限、Content Script DOM 批处理

## 最小可执行任务

### 1. Content Script 入口搭建
- [ ] 创建 `entrypoints/content.ts`（WXT content script entrypoint）
- [ ] ✅ **使用默认 `world: 'ISOLATED'`**（参考 chrome-extensions 风险评估：不要使用 `world: 'MAIN'`，会大幅增加 Store 审核风险）
  - defuddle 只需要读取 DOM（DOM 在 ISOLATED world 中完全可访问）
  - ISOLATED world 已能满足"不污染页面 JS 上下文"的需求
  - 配置：`matches: ['<all_urls>']`（依赖 `host_permissions: <all_urls>`，参考 `foundation.md` 章节 1）
- [ ] 注入悬浮捕获按钮（`CaptureButton.vue` 或纯 DOM 按钮）
- [ ] 绑定点击事件 → 触发捕获流程（参考 `content.ts` 的 `toggleIframe` 点击处理）
- [ ] ⚠️ **不要在 `chrome.runtime.onMessage` 中存储全局变量**（参考 chrome-extensions 规则 #7：使用 `chrome.storage.session`）

### 2. defuddle 集成与正文提取
- [ ] 安装 `defuddle` 依赖（参考 `obsidian-clipper` 的 `package.json`）
- [ ] 从 `defuddle/full` 导入 `createMarkdownContent()`（参考 `content-extractor.ts` 第 2 行）
- [ ] 在 Content Script 中 `clone` 当前 `document` 并调用 `defuddle.parseAsync()`（参考 `content-extractor.ts` 的 `extractPageContent` 函数）
- [ ] 获取 `markdownContent` 和元数据（参考 `content-extractor.ts` 返回的 `ContentResponse` 结构）
- [ ] **降级处理**：defuddle 解析失败时回退到 `document.body.innerText` + 简单 Markdown 转换（参考 `content-extractor.ts` 的 fallback 逻辑）

### 3. 元数据自动提取
- [ ] 提取 `title`（`document.title`，参考 `shared.ts` 的 `buildVariables`）
- [ ] 提取 `url`（`location.href`，参考 `shared.ts` 的 `currentUrl` 处理）
- [ ] 提取 `author`（meta / schema.org / JSON-LD，参考 `content-extractor.ts` 的元数据提取逻辑）
- [ ] 提取 `publishedAt`（meta / schema.org，参考 `content-extractor.ts` 的 `published` 字段）
- [ ] 提取 `favicon`（`document.querySelector('link[rel*="icon"]')?.href`，参考 `shared.ts`）
- [ ] 提取 `description`（`meta[name="description"]`，参考 `content-extractor.ts`）
- [ ] 提取 `keywords`（`meta[name="keywords"]`，参考 `content-extractor.ts` 的 `metaTags` 处理）
- [ ] 提取 `siteName`（`og:site_name` 或域名，参考 `shared.ts` 的 `{{site}}` 和 `{{domain}}`）
- [ ] 提取 `image`（`og:image` 或首图，参考 `shared.ts` 的 `{{image}}`）
- [ ] 提取 `wordCount`（Markdown 字数统计，参考 `content-extractor.ts` 的 `wordCount` 计算）
- [ ] 提取 `language`（`document.documentElement.lang` 或自动检测，参考 `content-extractor.ts`）
- [ ] 提取 `schemaOrgData`（页面内 JSON-LD / schema.org 脚本，参考 `content-extractor.ts` 的 `schemaOrgData` 提取）

### 4. 捕获结果标准化
- [ ] 定义 `CapturedDocument` 接口（参考 `types.ts` 的 `ExtractedContent` 和 `ContentResponse` 结构）
- [ ] 生成唯一 `id`（参考 `import-export.ts` 的 `Date.now().toString() + Math.random().toString(36).slice(2, 9)`）
- [ ] 填充 `createdAt` / `updatedAt` 时间戳（使用 `dayjs`，参考 `shared.ts`）
- [ ] 组装完整 `CapturedDocument` 对象（参考 `content-extractor.ts` 返回的完整数据结构）

### 5. 跨上下文通信
- [ ] Content Script 通过 `chrome.runtime.sendMessage` 发送 `CAPTURE_PAGE` 消息（参考 `content.ts` 的 `sendMessage` 模式）
- [ ] Background Service Worker 接收消息并转发到 Side Panel（参考 `background.ts` 的消息路由）
- [ ] ⚠️ **异步响应必须 `return true`**（参考 chrome-extensions 规则 #5，参考 `foundation.md` 章节 5）：
  ```ts
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    (async () => {
      const result = await handleCapture(message.payload);
      sendResponse({ success: true, data: result });
    })();
    return true; // 关键！
  });
  ```
- [ ] 定义消息类型（参考 `types.ts` 的接口定义风格）

### 6. 持久化到 IndexedDB
- [ ] Background 调用 `documentRepository.put(document)`（参考 `storage-utils.ts` 的 `setLocalStorage` / `getLocalStorage` 模式，迁移到 Dexie）
- [ ] 写入 `documents` 表（Dexie，参考 `obsidian-clipper` 使用 `browser.storage.local` 的存储模式）
- [ ] 返回 `documentId`（参考 `content-extractor.ts` 的 `sendExtractRequest` 返回结构）

### 7. 通知搜索索引更新
- [ ] Background 通过 `postMessage` 通知 `search.worker.ts`
- [ ] Worker 执行 `MiniSearch.addDocument()` 增量更新

### 8. 打开 Side Panel 展示
- [ ] Background 调用 `chrome.sidePanel.open({ tabId })`（参考 chrome-extensions 规则 #2，参考 `foundation.md` 章节 1）
- [ ] Side Panel 接收 `documentId` 并读取文档
- [ ] UI 展示 Markdown 内容、元数据摘要、对话入口

---

## ⚠️ 大规模 DOM 修改规范

未来扩展（如阅读模式高亮、笔记标注）需要修改大量 DOM 元素时，**必须使用 `requestAnimationFrame` 批处理**（参考 chrome-extensions 规则 #6）：

```ts
// ✅ 正确：分批处理
async function highlightAll(elements: Element[]) {
  const BATCH = 20;
  for (let i = 0; i < elements.length; i += BATCH) {
    await new Promise(r => requestAnimationFrame(() => {
      elements.slice(i, i + BATCH).forEach(el => el.classList.add('highlighted'));
      r();
    }));
    if (globalThis.scheduler?.yield) await scheduler.yield();
  }
}

// ❌ 错误：一次性修改，阻塞主线程
elements.forEach(el => el.classList.add('highlighted'));
```

---

## 验收标准
- [ ] 任意网页点击悬浮按钮后，3 秒内完成捕获并展示在 Side Panel（参考 `content.ts` 的 `toggleIframe` 和 `popup.ts` 的初始化流程）
- [ ] 元数据提取完整度 ≥ 80%（主流新闻/博客/文档站点，参考 `content-extractor.ts` 的测试固件 `fixtures/`）
- [ ] 解析失败时有降级，不阻塞流程（参考 `content-extractor.ts` 的 fallback 逻辑）
- [ ] 捕获后搜索索引自动更新，可立即检索到（参考 `background.ts` 的消息通知机制）
- [ ] ✅ **ISOLATED world 工作正常**（不污染页面 JS 上下文，参考 chrome-extensions 风险评估）

## 依赖模块
- `db/dexie.ts`（IndexedDB 表定义）
- `workers/search.worker.ts`（索引更新）
- `entrypoints/background.ts`（消息中转，参考 `foundation.md` 章节 1 Side Panel 触发器）
- `entrypoints/sidepanel/`（展示界面）

## 参考资料
- [chrome-extensions] skill - Content Scripts & DOM (规则 #6)
- `obsidian-clipper/content-extractor.ts` - defuddle 集成
- `obsidian-clipper/content.ts` - 按钮注入模式
- `obsidian-clipper/background.ts` - 消息路由
