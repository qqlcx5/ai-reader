---
AIGC:
    Label: "1"
    ContentProducer: 001191440300708461136T1XGW3
    ProduceID: d270bcd3df6a2cd27c2792fa9a0b45ef_ff28350c6d8e11f18805525400d9a7a1
    ReservedCode1: F7+O2vWOTfFKfhX7XR7H3EBOd7A+48cTJalRlOvJ6CJ/H9Wi2ArRtbMVLlTeyVfn7RWMe3HKp9JVdX7ZRpcfPiFLQPieI7BFWTHFV6+DrWnFF2EY02ZtcrzNQmddL9kB2C6MuKD0dsODLcb2SsYN6QS6qJq/9iKGHU+xRaDyby5WaOHzsdygmQLha/Y=
    ContentPropagator: 001191440300708461136T1XGW3
    PropagateID: d270bcd3df6a2cd27c2792fa9a0b45ef_ff28350c6d8e11f18805525400d9a7a1
    ReservedCode2: F7+O2vWOTfFKfhX7XR7H3EBOd7A+48cTJalRlOvJ6CJ/H9Wi2ArRtbMVLlTeyVfn7RWMe3HKp9JVdX7ZRpcfPiFLQPieI7BFWTHFV6+DrWnFF2EY02ZtcrzNQmddL9kB2C6MuKD0dsODLcb2SsYN6QS6qJq/9iKGHU+xRaDyby5WaOHzsdygmQLha/Y=
---

# 模块 02：上下文提取与无界锚定

> 对应设计文档：design-02-extraction.md

## 子任务清单

- [ ] 子任务 1：在 content script 中实现 `extractPage()` 主入口，编排三级降级链路：defuddle 本地（首选，调用 `createMarkdownContent()`，5s 超时）→ defuddle 远程 API（8s 超时，复用 `extractPageContent` + `initializePageContent` 双阶段模式）→ innerText 兜底（清洗 `<script>`/`<style>` 后取 `body.innerText`）
- [ ] 子任务 2：实现 `defuddle-local.ts` 提取器：调用 `defuddle(document, { markdown: true })`，一步完成 DOM 正文提取到结构化 Markdown；失败条件为内容 `< MIN_CONTENT_LENGTH`（默认 200 字符）或超时
- [ ] 子任务 3：实现 `defuddle-remote.ts` 提取器：调用 Defuddle 服务端接口，设定 8s 超时，先获取元数据再异步加载正文
- [ ] 子任务 4：实现 `innerText.ts` 兜底提取器：移除 `<script>`/`<style>`/`<nav>`/`<footer>`/`<aside>`/`<header>` 后提取 `body.innerText`，清洗多余空行
- [ ] 子任务 5：实现 `metadata.ts` 结构化元数据提取，采集三类变量：① Preset 预置变量（title/author/description/published/site/domain/favicon/image/words）；② Meta 元变量（`<meta>` 标签 Open Graph 数据）；③ Schema.org 结构化数据（解析 JSON-LD/Microdata，支持 `@Article`/`@Recipe`/`@Product` 等类型）
- [ ] 子任务 6：实现高亮选区系统 `highlights/`：① 三种内容模式（embed：嵌入 `==highlight==` 标记 / list-only：仅提取高亮列表 / ignore：忽略）；② Dexie.js 按域名分组持久化高亮数据；③ 页面重新打开时 content script 恢复高亮标记；④ 支持 `.json` 导出
- [ ] 子任务 7：实现 10 种高亮标记样式预设（点状下划线/高亮背景色/模糊/波浪线/弱化/边框/分割线/斜体/加粗/自定义 CSS），支持绑定用户标签（重点/疑问/待办）
- [ ] 子任务 8：实现选区浮动工具栏 `floating-bar.ts`：划选文本后弹出，定位在选区附近并自动避边；提供解释/总结/翻译/提问四个快捷操作；使用 Shadow DOM 承载避免宿主 CSS 冲突；点击页面空白处消失
- [ ] 子任务 9：实现右键菜单 `context-menu.ts`：通过 `chrome.contextMenus` 动态注册 AI 操作项（解释/总结/翻译/朗读/搜索），仅在有选区时显示
- [ ] 子任务 10：实现 `shadow-dom.ts` Shadow DOM 隔离工具：配合 BEM 或 CSS Modules 命名隔离，确保浮动工具栏与右键注入 UI 在任何网页上视觉一致
- [ ] 子任务 11：实现大文本分片传输 `transfer.ts`：定义 `ChunkedTransfer` 协议（transferId / totalChunks / chunkIndex / chunkData / isLast，每片 1MB），Background 作中转缓存，支持断点续传（按 chunkIndex 重传）
- [ ] 子任务 12：实现上下文锚定机制：Background 监听 `tabs.onActivated` 仅更新 UI Store 当前 Tab 信息，不自动替换 `currentContext`；仅用户点击「⟳ 刷新提取」才触发新提取
- [ ] 子任务 13：编写各提取器单元测试（标准 HTML 输出正确性）、分片传输重组测试、降级链路覆盖测试、元数据提取完整性测试、高亮样式注入测试、浮动工具栏定位与右键菜单触发集成测试
*（内容由AI生成，仅供参考）*
