# M2 上下文提取模块开发笔记

> 记录实现过程中发现的设计文档遗漏或错误，供后续迭代参考。

## 1. Defuddle API 差异

- **设计文档**假设 `defuddle(document, { markdown: true })` 可直接调用。
- **实际** `defuddle` v0.19 使用类构造器模式：`new Defuddle(doc, { markdown: true }).parse()`。
- **处理**：在 `extractors/defuddle.ts` 中同时兼容 `new Defuddle()` 和直接调用两种形式，使用 `Promise.race` 实现超时。

## 2. WXT 全局变量

- **设计文档**使用 `chrome.runtime` / `chrome.tabs` / `chrome.storage`。
- **实际** WXT 项目使用 `browser` 全局变量（WebExtension API 的跨浏览器封装）。
- **处理**：
  - `entrypoints/content.ts` 中改用 `browser.runtime.onMessage`。
  - `background-integration.ts` 中改用 `browser.tabs.sendMessage` 和 `browser.storage.local`。

## 3. 构建时模块解析

- **问题**：`background-integration.ts` 直接 `import { getChunkCache } from '@/modules/storage'` 导致 WXT 构建失败（`Cannot find module '@/modules/storage'`）。
- **根因**：WXT 的 jiti 在构建时解析所有模块，`@/modules/storage/index.ts` 中的 Dexie 初始化在 Node 环境报错。
- **处理**：改为动态导入 `await import('@/modules/storage/chunk-cache')`，仅在运行时加载。

## 4. 测试环境 DOMParser

- **问题**：vitest 默认 Node 环境无 `DOMParser`。
- **处理**：创建 `vitest.config.ts`，设置 `environment: 'jsdom'`。

## 5. jsdom location 属性

- **问题**：jsdom 的 `document.location` 是只读属性，无法通过 `Object.defineProperty` 重新定义。
- **处理**：测试中使用 `(doc as any).__location` 替代，提取器中通过 `doc.location?.href || (doc as any).__location?.href || ''` 兼容。
- **说明**：生产环境（真实浏览器）中 `document.location` 始终可用，此兼容仅用于测试。

## 6. 内容长度阈值

- **设计文档**规定 `MIN_CONTENT_LENGTH = 200`。
- **实际验证**：Readability 对短内容返回 `null`，innerText 对空 body 返回空字符串，降级链路正常工作。

## 7. 分片传输阈值

- **设计文档**未明确何时触发分片。
- **实现**：在 `content.ts` 中设定 `context.content.length > 1024 * 1024`（1MB）时触发分片，返回 `TRANSFER_META`，由 Background 按需请求各分片。

## 8. 依赖版本

- `@mozilla/readability`: 0.6.0
- `turndown`: 7.2.4
- `defuddle`: 0.19.0

## 9. 后续优化建议

- 考虑在 `extractors/readability.ts` 中增加 `turndown` 选项自定义（如代码块风格、链接处理）。
- 大文本分片传输可考虑增加压缩（如 `pako`）以减少传输量。
- 上下文锚定目前通过 `chrome.storage.local` 写入，后续可接入 M7 的 `contextStore` 以统一状态管理。
