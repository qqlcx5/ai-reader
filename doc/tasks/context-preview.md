# 上下文预览 (context-preview)

- [ ] ContextPanel 二级 Tab：`src/components/workspace/ContextPanel.vue` 实现 Markdown / Raw / Meta 三个二级 Tab 切换，使用 `SegmentedControl` 组件
- [ ] MarkdownPreview — 安全渲染：`src/components/workspace/MarkdownPreview.vue`，使用 `marked` 或手写简单解析器将 markdown 转为 HTML，调用 `DOMPurify.sanitize()` 清洗后通过 `v-html` 渲染，确保不执行任何脚本
- [ ] MarkdownPreview — 代码高亮：集成 `highlight.js`，对 `<pre><code>` 块调用 `hljs.highlightElement()`，支持常见语言自动检测
- [ ] MarkdownPreview — 完整元素渲染：支持标题（h1-h6）、段落、有序/无序列表、引用块（blockquote）、表格（含对齐）、分割线
- [ ] RawPreview 组件：`src/components/workspace/RawPreview.vue`，深色背景（`bg-gray-900`）、等宽字体（`font-mono`）、保留换行（`white-space: pre-wrap`）、`overflow-y-auto` 可滚动，内容为 `document.rawText` 或 `document.markdown` 源码
- [ ] MetadataPanel 组件：`src/components/workspace/MetadataPanel.vue`，以表单只读模式展示：title / url / canonicalUrl / siteName / author / description / publishedAt / capturedAt / updatedAt / wordCount / tokenCount / extractionMethod / contentHash / source / localStatus
- [ ] 复制 Markdown 按钮：在 MarkdownPreview 顶部放置复制按钮，点击调用 `navigator.clipboard.writeText(document.markdown)`，复制后显示 toast "已复制"
- [ ] ContextView 内刷新按钮：ContextPanel 顶部放置刷新按钮（复用 WorkspaceHeader 刷新逻辑），点击后重新抓取当前页面并刷新预览
- [ ] rawHtml 可选保存：根据 `CaptureSettings.saveRawHtml` 决定是否将清洗后 HTML 存入 `DocumentEntity.rawHtml`；若 `compressRawHtml` 为 true 则使用 `lz-string.compress()` 压缩
