# 网页抓取与上下文 (web-capture)

- [ ] content.ts — 获取页面 HTML：`src/entrypoints/content.ts` 注入当前页面，读取 `document.documentElement.outerHTML`
- [ ] content.ts — defuddle 提取正文：调用 defuddle 从 HTML 中提取 `title / markdown / rawText / siteName / author / description / publishedAt / canonicalUrl`，组装为 `ExtractedPage` 结构
- [ ] content.ts — DOMPurify 清洗 HTML：对原始 HTML 调用 `DOMPurify.sanitize()`，仅保留安全标签和属性
- [ ] content.ts — 计算 contentHash / wordCount / tokenCount：使用 `crypto.subtle.digest('SHA-256')` 对 markdown 取 hash；wordCount 按空白分割统计；tokenCount 按 `markdown.length / 4` 粗略估算
- [ ] content.ts — fallback 逻辑：defuddle 返回空 markdown 或抛出异常时，使用 `document.title` + `document.body.innerText`（过滤连续空行），标记 `extractionMethod = 'fallback'`
- [ ] content.ts — SPA 路由变化监听：在 content script 中拦截 `history.pushState` / `history.replaceState`，监听 `popstate` 事件，URL 变化时通知 background
- [ ] background ↔ sidepanel ↔ content 通信通道：在 background.ts 中实现 `browser.runtime.onMessage` 路由，转发 sidepanel 的抓取请求到 content script，回传 `ExtractedPage` 结果。消息类型：`REQUEST_EXTRACT` / `EXTRACT_RESULT` / `EXTRACT_ERROR`
- [ ] WorkspaceHeader 组件：`src/components/workspace/WorkspaceHeader.vue` 展示当前文档标题、URL 来源域名（截取 hostname）、token 估算、抓取状态指示灯（idle/extracting/ready/cached/failed/stale 六色圆点）
- [ ] 手动刷新按钮：WorkspaceHeader 中点击刷新 → 向 content script 发送 `REQUEST_EXTRACT` → 更新 `documentStore.currentDocument` → 写 IndexedDB → 刷新 UI。若当前是历史文档则 `ask_user` 确认是否切换回浏览器页面
- [ ] 自动抓取开关：`CaptureSettings.autoExtractOnOpen` 控制打开侧边栏时是否自动触发抓取；`CaptureSettings.autoExtractOnTabChange` 控制切换 Tab 时是否自动抓取
