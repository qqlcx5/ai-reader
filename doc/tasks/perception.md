# 捕获层：网页提取与 Markdown 生成 (P0)

> **模块名称**: perception  
> **优先级**: P0（MVP 核心闭环）  
> **依赖关系**: 依赖 foundation.md（消息通信框架）  
> **目标**: 实现 Content Script 中的网页正文提取与 Markdown 生成 Pipeline，对齐 detail.md §3.3 + §3.4 + §11.1-11.3

---

## 子任务

### Content Script 入口搭建
- [ ] 创建 `entrypoints/content.ts`：WXT content script entrypoint，注册 `chrome.runtime.onMessage` 监听
- [ ] 实现 `ping` 消息响应（对齐 detail.md §11.1.3a：Background ping 就绪检测）
- [ ] 实现 Generation Counter 僵尸脚本处理（`window.__pageMindGeneration`，对齐 detail.md §11.1.3b）
- [ ] 实现消息分发：根据 `action` 路由到 `handleExtract` / `handleMetadata`

### Shadow DOM 扁平化
- [ ] 创建 `core/extraction/shadow-dom.ts`
- [ ] 实现 `flattenShadowDom(root: Document | Element): void`：递归遍历 Shadow DOM 边界，将内容扁平化到主文档树
- [ ] 处理嵌套 Shadow DOM（多层 Web Components）
- [ ] 编写单元测试：验证 Shadow DOM 内文本可被提取

### defuddle 集成
- [ ] 安装 `defuddle` 依赖
- [ ] 创建 `core/extraction/defuddle-adapter.ts`
- [ ] 实现 `extractContent(document: Document, url: string): Promise<ExtractResult>`
- [ ] 实现 `parseAsync()` 调用 + 8s 超时保护（`Promise.race`，对齐 detail.md §11.3.2）
- [ ] 实现超时回退：`parseAsync` 超时 → `parse()` 同步提取
- [ ] 提取结果结构映射：`title / content / author / description / domain / favicon / image / published / wordCount`

### Markdown 生成
- [ ] 创建 `core/markdown/markdown-generator.ts`
- [ ] 实现 `createMarkdownContent(contentHtml: string, url: string): string` — 在 Content Script 中调用（对齐 detail.md §11.2.2）
- [ ] 实现 Frontmatter 生成：title / url / site / author / publishedAt / savedAt（对齐 detail.md §3.4 推荐结构）
- [ ] 边界处理：无作者省略字段、无发布时间用 undefined、HTML 转 MD 失败回退纯文本、空标题用 hostname

### 元数据自动提取
- [ ] 创建 `core/metadata/metadata-parser.ts`
- [ ] 实现 `extractPageMetadata(document: Document, url: string): PageMetadata`
- [ ] 实现 title 优先级：`og:title` → `twitter:title` → `document.title`（对齐 detail.md §3.2 优先级表）
- [ ] 实现 siteName 优先级：`og:site_name` → hostname
- [ ] 实现 author 优先级：`article:author` → `meta[name=author]` → JSON-LD
- [ ] 实现 publishedAt 优先级：`article:published_time` → JSON-LD → 页面时间标签
- [ ] 实现 description 优先级：`og:description` → `meta[name=description]`
- [ ] 实现 favicon 提取：`link[rel*=icon]` → 默认站点首字母
- [ ] 实现 language 提取：`document.documentElement.lang`
- [ ] 编写单元测试：验证各优先级回退逻辑

### 提取结果标准化
- [ ] 定义 `CapturedDocument` 接口（对齐 detail.md §3.5 SavedArticle）
- [ ] 实现 `normalizeResult(metadata, extractResult, markdown): CapturedDocument`
- [ ] 生成 `id`（UUID v4）、`createdAt`（ISO 8601）、`updatedAt`

### 提取 Pipeline 状态流
- [ ] 定义 `CaptureStep` 状态机：`idle → extracting → markdown → saving → success/error`
- [ ] 实现 `runCapturePipeline(tabId, url): Promise<CapturedDocument>` — 在 Background 中协调
- [ ] Background 通过 Port 向 Popup 推送 Pipeline 进度（对齐 detail.md §2.2）
- [ ] Popup 端 `useCapture` composable：监听进度并更新 UI 状态

### 跨上下文通信
- [ ] 定义提取相关消息类型：`EXTRACT_PAGE`、`GET_PAGE_METADATA`、`CAPTURE_PROGRESS`
- [ ] Background: 接收 `EXTRACT_PAGE` → inject Content Script → 转发提取请求 → 返回结果
- [ ] Content Script: 接收提取请求 → 执行 Pipeline → `sendResponse(result)`
- [ ] 所有异步监听器返回 `true`（保持 `sendResponse` 通道开启）

### 提取结果缓存
- [ ] 实现提取结果 Memoization（对齐 detail.md §11.1.5）
- [ ] 缓存键：`tabId + url`
- [ ] TTL：5 秒
- [ ] 用户点击「复制 Markdown」或「仅预览」时优先使用缓存

### Content Script Bundle 体积控制
- [ ] 配置 webpack / WXT：Popup 用 Vue，Content Script 不包含 Vue 运行时（对齐 detail.md §11.3.7）
- [ ] defuddle + markdown 模块实现动态 `import()`：仅在收到 `extract` 消息时加载（对齐 detail.md §11.3.5）
- [ ] 验证 gzip 后 Content Script 体积 < 50KB
- [ ] 若超过 50KB：改为 `chrome.scripting.executeScript` 按需注入提取脚本

### 错误处理
- [ ] 定义 9 种错误码对应的 Error 类：`CaptureError(code, message, recoverable)`
- [ ] 实现错误码 → UI 状态映射（对齐 detail.md §8.2）
  - `NO_ACTIVE_TAB` → Toast: 未找到当前页面
  - `UNSUPPORTED_PAGE` → CurrentPageCard 显示不可提取状态
  - `PERMISSION_DENIED` → Toast + 权限引导
  - `EXTRACTION_FAILED` → Pipeline Step 1 标红，按钮变重试
  - `MARKDOWN_FAILED` → Pipeline Step 2 标红，允许重试
  - `INDEXEDDB_FAILED` → Pipeline Step 3 标红，提示存储不可用
  - `CONTENT_SCRIPT_FAILED` → Toast 提示
  - `CLIPBOARD_FAILED` → Toast: 复制失败
  - `UNKNOWN_ERROR` → Toast 通用提示

---

## 验收标准

- [x] 任意普通网页点击「提取正文并保存」可成功返回 Markdown
- [x] Shadow DOM 内正文不被遗漏（验证 Web Components 页面）
- [x] 8s 超时后自动回退同步提取，不卡死
- [x] 提取结果缓存 5 秒内有效，点击复制不重复提取
- [x] Content Script bundle gzip < 50KB
- [x] 错误场景均有明确 UI 反馈

## 依赖模块

- `foundation.md` — 消息通信框架、Background Service Worker

## 关联文件

- `detail.md` §3.2 当前页检测、§3.3 网页提取、§3.4 Markdown 生成
- `detail.md` §11.1 Content Script 架构、§11.2 潜在冲突、§11.3 技术优化
- `design.html` Tab 1 当前网页捕获 UI
