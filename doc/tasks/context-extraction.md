# M2 上下文提取 — Vibe Coding 任务清单

> **目标**：在 content script 中实现三级降级正文提取，并将结果完整传输到 Background。
> **输入**：`doc/1.md` 模块 1、`doc/design-02-extraction.md`
> **建议执行顺序**：与 M7 并行开始；可在 M1 之前完成核心提取逻辑。

---

## 1. 依赖安装与目录

- [x] 安装 `@mozilla/readability`、`turndown`、`defuddle`
- [x] 创建 `modules/extraction/` 目录结构
- [x] 创建 `modules/extraction/types.ts` 定义 `ExtractedContext`、`ExtractRequest`、`ExtractResponse`
- [x] 创建 `modules/extraction/__tests__/fixtures/` 存放 5 类测试 HTML 快照

---

## 2. Readability 提取器

- [x] 实现 `modules/extraction/extractors/readability.ts`
- [x] 使用 `new Readability(document.cloneNode(true))` 解析
- [x] 使用 `turndown` 将 HTML 正文转为 Markdown
- [x] 返回 `ExtractedContext`，包含 `extractor: 'readability'`
- [x] 如果内容长度 < 200 字符，返回 `null` 以触发降级
- [x] 对 3 个真实网页运行测试，验证提取质量

---

## 3. Defuddle 提取器

- [x] 实现 `modules/extraction/extractors/defuddle.ts`
- [x] 调用 `defuddle(document, { markdown: true })`
- [x] 使用 `Promise.race` 实现 8 秒超时
- [x] 超时或失败时返回 `null` 以触发降级
- [x] 返回 `ExtractedContext`，包含 `extractor: 'defuddle'`
- [x] 对 3 个真实网页运行测试

---

## 4. innerText 兜底

- [x] 实现 `modules/extraction/extractors/innerText.ts`
- [x] 移除 DOM 中的 `<script>`、`<style>`、`<nav>`、`<footer>`、`<aside>`、`<header>`
- [x] 提取 `document.body.innerText`
- [x] 清洗多余空行
- [x] 返回 `format: 'text'`、`extractor: 'innerText'`

---

## 5. 三级降级主入口

- [x] 实现 `modules/extraction/extractPage.ts`
- [x] 按 Readability → Defuddle → innerText 顺序执行
- [x] 记录最终使用的提取器
- [x] 预估字数：中文字符 + 英文单词
- [x] 在测试页面上验证三级降级链路

---

## 6. Content Script 注入

- [x] 修改 `entrypoints/content.ts`：匹配 `['<all_urls>']`（或按需配置）
- [x] 监听 `runtime.onMessage` 中的 `EXTRACT_PAGE` 请求
- [x] 调用 `extractPage()` 并返回元数据（不含完整内容）
- [x] 确保在 DOM 未就绪时等待 `DOMContentLoaded` 后重试一次

---

## 7. 大文本分片传输

- [x] 实现 `modules/extraction/transfer.ts`：定义分片协议（1MB/片）
- [x] 在 content script 中将大文本切分为 `ChunkedTransfer` 数组
- [x] 在 Background 中实现分片请求 → 接收 → 拼接 → 缓存
- [x] 实现断点续传：按 `chunkIndex` 可单独请求缺失分片
- [x] 用 10MB 以上文本测试分片传输完整性与性能

---

## 8. 上下文锚定

- [x] Background 接收提取结果后写入 M7 的 `currentContext`
- [x] 切换 Tab 时不主动重新提取
- [x] Side Panel 的「刷新提取当前 Tab」按钮触发新的提取流程
- [x] 验证 Tab 切换后上下文保持原页面

---

## 验收标准

1. 在新闻、博客、SPA 三种典型页面上，至少有一种提取器能返回非空正文。
2. 三级降级链路覆盖：Readability 失败 → Defuddle 失败 → innerText 成功。
3. 10MB 长文本分片传输后，MD5 与原内容一致。
4. Tab 切换不改变 Side Panel 中的上下文状态，直到用户手动刷新。

---

## 依赖提醒

- **阻塞项**：M7 需提供 `currentContext` 写入接口。
- **后续接入**：M1 的 Side Panel 将展示 `currentContext`。
