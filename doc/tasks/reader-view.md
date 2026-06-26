# reader-view — 阅读器 (ReaderView)

> 详细设计参考：doc/detail.md §3.8 (阅读器模块)
> 现有代码：components/views/ReaderView.vue（已有 UI，Markdown 渲染为自写简单 parser，无安全过滤）

技术栈：marked（Markdown 解析）、DOMPurify（XSS 过滤）

---

## 任务清单

### 1. Markdown 渲染升级

- [ ] 安装 `marked` 和 `dompurify`（已在 package.json 中）
- [ ] 创建 `utils/markdown-renderer.ts`，实现 `renderMarkdown(md: string): string`
- [ ] 流程：`marked.parse(md)` → `DOMPurify.sanitize(html)` → 返回安全 HTML
- [ ] 替换 ReaderView.vue 中现有的自写 `renderMarkdown()` 函数
- [ ] 配置 marked：启用 GFM（GitHub Flavored Markdown），支持表格、代码块、任务列表

### 2. 链接安全处理

- [ ] DOMPurify 配置：所有 `<a>` 标签添加 `target="_blank"` + `rel="noopener noreferrer"`
- [ ] 图片协议白名单：仅允许 `https:` 和 `data:`，禁止 `javascript:` 和 `file:`
- [ ] 禁止 `<script>`、`<iframe>`、事件属性（`onclick` 等）

### 3. 代码高亮（可选）

- [ ] 集成 `highlight.js`（已在 package.json 中），配置 marked 使用 highlight.js 做代码块高亮
- [ ] 仅加载常用语言包（JS, TS, Python, CSS, HTML, JSON, Bash），控制体积

### 4. 元数据信息网格

- [ ] 保持现有的 2×2 MetadataGrid（作者、发布时间、站点、保存时间）
- [ ] `readingTime` 字段：显示「预计 N 分钟」
- [ ] 无字段时显示「未知」而非空值

### 5. 操作按钮

- [ ] 「← 文章库」返回按钮：切换到 LibraryView
- [ ] 「复制」按钮：`navigator.clipboard.writeText(article.markdown)`，成功后 Toast
- [ ] 「删除」按钮：打开 ConfirmModal，确认后 `articleStore.deleteArticle(id)` 并返回文章库
- [ ] 删除后导航策略：当前文章被删除 → 返回文章库

### 6. 预览文章支持

- [ ] 如果 `article` 来自 CaptureView 的「仅预览」（未保存到 IndexedDB），顶部显示「预览中」标记
- [ ] 预览模式下「删除」按钮替换为「保存」按钮
- [ ] 点击「保存」→ `articleStore.saveArticle(draft)` → 切换到正常模式

### 7. 测试

- [ ] Markdown 渲染测试：标题、列表、代码块、链接、表格、图片
- [ ] XSS 过滤测试：注入 `<script>alert(1)</script>` 被清除
- [ ] 复制测试：复制内容与 article.markdown 一致

## 验收标准

- Markdown 内容正确渲染为 HTML（支持 GFM 扩展语法）
- `<script>` 等危险标签被 DOMPurify 清除
- 外链点击在新标签页打开
- 复制按钮成功复制 Markdown 原文
- 删除当前文章后返回文章库
