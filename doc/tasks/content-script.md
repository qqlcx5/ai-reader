# content-script — Content Script 提取与注入

> 详细设计参考：doc/detail.md §3.2 (当前页检测)、§3.3 (网页提取)、§3.4 (Markdown 生成)
> 技术参考：obsidian-clipper Content Script 实现

技术栈：defuddle（正文提取 + Markdown 生成）、WXT Content Script API

---

## 任务清单

### 1. Content Script 基础

- [ ] 修改 `entrypoints/content.ts`，matches 改为 `<all_urls>`，声明 `world: 'MAIN'`（如需访问页面 JS 变量）
- [ ] 实现 `ping` 消息响应（用于注入就绪检测）

### 2. Shadow DOM 扁平化

- [ ] 创建 `utils/shadow-dom.ts`，实现 `flattenShadowDom(root: Document)` —— 递归遍历所有元素，将 ShadowRoot 内容 clone 到 light DOM
- [ ] 处理嵌套 Shadow DOM（Web Components 内嵌 Web Components）
- [ ] 3 秒超时保护，避免复杂页面卡死

### 3. 元数据提取

- [ ] 创建 `utils/metadata-extractor.ts`，实现 `extractMetadata(doc: Document, url: string): PageMetadata`
- [ ] title 优先级：`og:title` → `twitter:title` → `document.title`
- [ ] siteName 优先级：`og:site_name` → `hostname`
- [ ] author 优先级：`article:author` → `meta[name=author]` → JSON-LD
- [ ] publishedAt 优先级：`article:published_time` → JSON-LD → 时间标签
- [ ] description 优先级：`og:description` → `meta[name=description]`
- [ ] favicon 优先级：`link[rel*=icon]` → 默认首字母
- [ ] readingTime 由 wordCount 估算（中文按 300 字/分钟，英文按 200 词/分钟）

### 4. defuddle 提取

- [ ] 创建 `utils/extractor.ts`，实现 `extractContent(doc: Document, url: string): Promise<ExtractResult>`
- [ ] 调用 `flattenShadowDom(doc)` 后再提取
- [ ] 使用 `new Defuddle(doc, { url }).parseAsync()`，8 秒超时回退同步 `parse()`
- [ ] 调用 `createMarkdownContent(result.content, url)` 生成 Markdown
- [ ] 合并元数据（defuddle 返回 + 自定义 extractMetadata）到最终结果
- [ ] 异常时回退到 `document.body.innerText` 作为纯文本兜底

### 5. 消息处理

- [ ] 在 `content.ts` 中监听 `EXTRACT_PAGE` 消息，调用 `extractContent()` 并返回结果
- [ ] 所有异步 handler 返回 `true` 保持 sendResponse 通道
- [ ] 实现 Generation Counter：`window.__pageMindGeneration`，旧脚本自动退出

### 6. Content Script Bundle 优化

- [ ] 确认 defuddle 是否需要按需加载（动态 import），控制注入体积 < 50KB gzip
- [ ] 如需按需加载，拆分为 `content.ts`（轻量消息监听）+ `content-extract.ts`（defuddle + 提取逻辑）

### 7. 测试

- [ ] 编写 metadata-extractor 单元测试：各字段优先级覆盖
- [ ] 编写 extractor 集成测试：mock DOM → 提取 → 验证 Markdown 输出
- [ ] 测试 Shadow DOM 扁平化：嵌套 Web Component 场景

## 验收标准

- 在任意文章页打开 Popup，点击提取后 3 秒内返回结果
- 提取结果包含 title、author、siteName、markdown 字段
- Shadow DOM 页面（如 Shoelace 组件文档）提取不为空
- 超时场景（8 秒）自动回退，不卡死
- 扩展更新后旧 Content Script 不干扰新版本
