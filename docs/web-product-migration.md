# AuraMind 独立 Web 产品迁移蓝图

- 文档版本：v0.1
- 目标：在保留 AuraMind 现有能力的基础上，迁移为可登录、可同步、可跨设备使用的独立 Web 产品
- 当前代码基线：Vue 3 + WXT + Pinia + Dexie + 本地 AI Provider + WebDAV/S3 同步
- 约束：本阶段不启动项目，不假设已有后端

## 1. 迁移结论

这不是把 WXT 入口改成普通网页，而是把现有产品拆成三层：

1. **共享领域层**：文档、阅读进度、标注、对话、模型、RSS、复习、导出等类型、规则和序列化逻辑。
2. **Web 应用层**：认证、路由、工作区、库、阅读器、AI 对话、批量分析、RSS、复习和设置界面。
3. **服务端能力层**：网页抓取、任务队列、AI 代理、对象存储、全文检索、RSS 调度、同步和导出。

Chrome 扩展保留为可选采集入口：负责当前页面快速采集并把任务发送到 Web API；独立 Web 端负责完整产品体验。

## 2. 当前能力盘点

| 领域 | 当前实现 | 迁移判断 |
|---|---|---|
| 网页采集 | WXT content script、`tabs`、`scripting`、capture service | 抽为服务端 URL 抓取；扩展保留当前页高保真采集 |
| 阅读器 | Vue 阅读视图、Markdown、KaTeX、highlight.js、阅读进度 | 共享渲染组件；阅读进度移到服务端，离线缓存可选 |
| 记忆库 | Dexie 文档、集合、搜索索引、标注 | 服务端数据库 + 搜索索引；客户端保留查询缓存 |
| AI 对话 | Pinia chat store、AI provider、流式响应、上下文拼装 | AI 密钥移到服务端；前端改为 SSE/WebSocket 客户端 |
| 批量分析 | `aiJobs`、workflows、schedules、analysisRules | 服务端任务队列和定时任务；前端显示任务状态 |
| RSS | feeds、feedItems、定时刷新、去重 | 服务端调度、解析和去重；客户端展示和阅读 |
| 复习 | SM-2 相关领域逻辑和 review 视图 | 服务端保存卡片与调度结果，离线复习可后置 |
| 同步 | WebDAV/S3 本地配置和同步逻辑 | 优先建设服务端 canonical data；WebDAV/S3 作为导出/备份适配器 |
| 模型 | 本地 ModelConfig、API Key、连接测试 | 服务端模型路由；用户只管理 provider 配置或模型偏好 |
| 设置 | 本地 settings store | 拆为账户设置、工作区设置、采集设置、AI 设置、同步设置 |

## 3. 目标产品结构

### 3.1 Web 路由

```text
/login
/onboarding
/app/workspace
/app/library
/app/library/:documentId
/app/reader/:documentId
/app/chat/:conversationId?
/app/analysis
/app/analysis/:jobId
/app/feeds
/app/feeds/:feedId
/app/review
/app/review/session/:sessionId
/app/settings/account
/app/settings/ai
/app/settings/capture
/app/settings/sync
/app/settings/shortcuts
```

### 3.2 主导航

- 工作台：当前任务、最近文档、待复习和运行中的 AI 任务。
- 记忆库：文档、集合、标签、搜索和批量选择。
- 阅读器：正文、目录、标注、笔记、阅读进度和关联对话。
- AI 对话：会话列表、模型、上下文、流式回复和导出。
- 批量分析：选择文档、选择工作流、执行和查看结果。
- RSS：订阅源、未读文章、刷新和归档。
- 复习：今日队列、评分、间隔和复习统计。
- 设置：账户、AI 模型、采集、同步、通知和快捷键。

## 4. 目标技术架构

### 4.1 前端

保留 Vue 3、Pinia、UnoCSS、Marked、DOMPurify、KaTeX 和 highlight.js。

新增或明确：

- 独立 Web entry，不依赖 WXT 运行时。
- Vue Router 负责页面和鉴权路由。
- `services/api` 统一处理 HTTP、SSE、鉴权刷新和错误映射。
- `services/cache` 负责 IndexedDB 缓存，不再把 IndexedDB 当作唯一数据源。
- 领域 store 不直接调用 Dexie；通过 repository 接口访问 API/cache。
- 所有异步任务具备 `pending/running/success/failed/cancelled` 状态。

### 4.2 服务端

推荐单体模块化服务先行，避免第一版过早拆微服务：

- Auth：账户、会话、邮箱验证、OAuth 可后置。
- Documents：URL 抓取、正文清洗、文档版本、标签、集合。
- Reader：阅读进度、标注、笔记、目录。
- Chat：对话、消息、SSE、上下文构建、用量。
- Models：模型注册、能力、路由、限额和密钥。
- Jobs：批量分析、工作流、调度、重试、取消。
- Feeds：RSS 订阅、刷新、解析、内容哈希去重。
- Review：卡片、评分、SM-2 调度、复习会话。
- Sync/Export：导出、导入、备份和版本冲突。

### 4.3 基础设施

- 关系数据库：PostgreSQL 或现有 D1 兼容层。
- 对象存储：S3 兼容存储，保存原始 HTML、图片、附件和导出包。
- 队列：Redis/BullMQ、Cloudflare Queues 或等效托管队列。
- 定时任务：服务端 scheduler，用于 RSS、批量分析和复习计划。
- 搜索：PostgreSQL 全文搜索起步，规模增长后接 Meilisearch/OpenSearch。
- AI：服务端统一代理供应商，浏览器不接触供应商密钥。

## 5. 领域数据模型

### User

```ts
interface User {
  id: string
  email: string
  displayName?: string
  createdAt: string
  updatedAt: string
}
```

### Document

```ts
interface Document {
  id: string
  ownerId: string
  url: string
  canonicalUrl?: string
  title: string
  siteName?: string
  author?: string
  description?: string
  markdown: string
  rawObjectKey?: string
  contentHash: string
  wordCount: number
  source: 'url' | 'extension' | 'upload' | 'rss'
  capturedAt: string
  updatedAt: string
  lastOpenedAt?: string
  readProgress: number
  readAt?: string
}
```

### Conversation / Message

复用 [`docs/web-chat-requirements.md`](./web-chat-requirements.md) 中的结构，但增加 `ownerId`、`documentIds`、`status`、`usage` 和服务端时间戳。消息内容和附件必须与账户绑定。

### AnalysisJob

```ts
interface AnalysisJob {
  id: string
  ownerId: string
  workflowId?: string
  documentIds: string[]
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'
  progress: number
  resultDocumentIds: string[]
  errorMessage?: string
  createdAt: string
  startedAt?: string
  completedAt?: string
}
```

### Feed / FeedItem

```ts
interface Feed {
  id: string
  ownerId: string
  url: string
  title: string
  folder?: string
  enabled: boolean
  lastFetchedAt?: string
  createdAt: string
  updatedAt: string
}

interface FeedItem {
  id: string
  feedId: string
  guid: string
  url: string
  title: string
  summary?: string
  publishedAt?: string
  readAt?: string
  savedDocumentId?: string
  contentHash: string
}
```

### ReviewCard

```ts
interface ReviewCard {
  id: string
  ownerId: string
  documentId?: string
  sourceHighlightId?: string
  prompt: string
  answer: string
  easeFactor: number
  intervalDays: number
  repetitions: number
  dueAt: string
  lastReviewedAt?: string
  suspendedAt?: string
}
```

## 6. 核心接口边界

### 认证

```text
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
POST /api/auth/refresh
GET  /api/me
```

### 网页采集与阅读

```text
POST /api/capture/url
POST /api/capture/upload
GET  /api/documents
GET  /api/documents/:id
PATCH /api/documents/:id
DELETE /api/documents/:id
POST /api/documents/:id/highlights
PATCH /api/documents/:id/read-progress
```

`POST /api/capture/url` 应返回同步结果或异步任务 ID。服务端必须设置抓取超时、重定向限制、robots/SSRF 防护和内容大小限制。

### 对话与模型

```text
GET  /api/models
GET  /api/conversations
POST /api/conversations
GET  /api/conversations/:id/messages
PATCH /api/conversations/:id
DELETE /api/conversations/:id
POST /api/conversations/:id/messages
POST /api/conversations/:id/stop
POST /api/messages/:id/regenerate
GET  /api/chat/stream/:messageId
```

### 批量分析

```text
GET  /api/workflows
POST /api/analysis-jobs
GET  /api/analysis-jobs
GET  /api/analysis-jobs/:id
POST /api/analysis-jobs/:id/cancel
POST /api/analysis-jobs/:id/retry
```

### RSS

```text
GET  /api/feeds
POST /api/feeds
PATCH /api/feeds/:id
DELETE /api/feeds/:id
POST /api/feeds/:id/refresh
GET  /api/feed-items
POST /api/feed-items/:id/save
PATCH /api/feed-items/:id/read
```

### 复习

```text
GET  /api/review/queue
POST /api/review/sessions
POST /api/review/cards/:id/grade
GET  /api/review/stats
```

### 同步与导出

```text
POST /api/exports
GET  /api/exports/:id
GET  /api/exports/:id/download
POST /api/imports
GET  /api/sync/status
POST /api/sync/push
POST /api/sync/pull
```

## 7. 扩展与 Web 的协作方式

### 7.1 扩展采集

1. 用户在网页点击扩展按钮。
2. content script 清洗当前页面，保留现有高保真提取逻辑。
3. 扩展通过 HTTPS API 上传内容到 Web 账户。
4. Web 端显示采集进度并刷新记忆库。

### 7.2 独立 Web URL 采集

1. 用户在 Web 输入 URL。
2. 服务端采集并清洗网页。
3. 创建 Document 和可选 AnalysisJob。
4. 前端通过 SSE 或轮询显示状态。

### 7.3 鉴权

- 扩展使用短期 access token 和 refresh token。
- Web 使用 HttpOnly Secure Cookie，避免把长期 token 放在 localStorage。
- 扩展和 Web 的数据权限统一由 `ownerId` 控制。

## 8. 迁移阶段与交付物

### Phase 0：基础设施和契约

交付：

- 独立 Web entry 和路由壳。
- Auth API、数据库迁移框架、API 错误格式。
- 领域类型从 WXT 入口解耦。
- 前端 API client、SSE client、鉴权守卫。
- 本地开发环境变量规范。

验收：登录后能进入空工作区，未登录不能访问 `/app/*`。

### Phase 1：网页采集、记忆库、阅读器

交付：

- URL 采集 API。
- 文档列表、搜索、集合、删除和标签。
- Markdown 阅读器、目录、进度、标注和笔记。
- 扩展上传到 Web 的采集桥。

验收：在 Web 输入 URL 或从扩展采集后，文档在另一台设备登录后可查看。

### Phase 2：AI 对话与批量分析

交付：

- 服务端模型路由和密钥管理。
- 对话列表、上下文选择、流式回复、停止、重试、重新生成。
- 工作流、批量选择、任务队列、进度和失败重试。

验收：同一账户的对话跨浏览器可见；刷新或断线后不会丢失已生成内容。

### Phase 3：RSS 与复习

交付：

- RSS 订阅、定时刷新、去重、未读和保存。
- 从文档/标注生成复习卡片。
- SM-2 调度、每日复习队列、评分和统计。

验收：RSS 新文章可保存为文档；复习评分会更新下一次到期时间。

### Phase 4：同步、导入导出和扩展兼容

交付：

- 旧 IndexedDB 数据导出与导入。
- WebDAV/S3 备份适配器。
- 冲突检测、版本号、幂等写入。
- 扩展切换为 Web API 数据源，同时保留离线采集缓存。

验收：旧用户数据可迁移；重复导入不会创建重复文档和重复消息。

### Phase 5：生产质量

交付：

- 监控、审计日志、限流、备份和恢复。
- 多租户隔离、SSRF 防护、文件扫描、内容安全策略。
- E2E 测试、迁移回滚方案、数据删除和账户注销流程。

## 9. 本地数据迁移策略

1. 扩展提供 `export-v1`，导出 documents、conversations、models、settings、feeds、review 和附件索引。
2. Web 提供导入任务，先校验 schema 版本和文件完整性。
3. 以 `contentHash` 去重文档，以原始 ID 映射对话和消息。
4. 本地 API Key 不导入服务端；用户需要重新配置或选择服务端模型。
5. WebDAV/S3 密码和密钥不进入导出文件，必须重新填写。
6. 导入采用事务/任务方式，失败时保留错误报告，不产生半完成成功提示。

## 10. 安全要求

- URL 抓取必须防 SSRF：禁止访问内网、loopback、云元数据地址和非 HTTP(S) 协议。
- 所有对象下载使用短期签名 URL。
- Markdown、RSS HTML 和网页内容统一做 HTML 清理。
- 模型密钥仅服务端持有，日志禁止打印 Authorization、API Key 和原文附件。
- 每个查询、任务、文件和下载都必须进行 owner 权限校验。
- 附件进行 MIME、扩展名、大小和恶意内容检查。
- AI 请求、网页抓取、RSS 刷新和批量分析分别限流。
- 支持账户数据导出、删除和注销后的异步清理。

## 11. 当前代码拆分原则

1. 保留 `types/` 中与业务无关的领域类型，移除对 `browser` 和 WXT 的依赖。
2. 将 `db/repositories` 改为接口：`LocalRepository`、`ApiRepository`、`HybridRepository`。
3. 将 `services/ai` 中的 provider 适配保留在服务端；前端只保留请求和流解析。
4. 将捕获逻辑分成 `extractHtml`、`extractUrl` 和 `uploadDocument` 三个边界。
5. 将 `chat.store` 的状态机保留，把持久化和 provider 调用替换成 API client。
6. `browser.runtime`、`tabs`、`scripting` 仅允许出现在扩展适配器中，不得进入共享组件。
7. 所有页面组件只依赖 store 和 composable，不直接依赖 Dexie、WXT 或供应商 SDK。

## 12. 首批实现顺序

第一批代码应只做以下工作：

1. 新增独立 Web 入口、路由和鉴权占位。
2. 新增共享 `api` client 和统一错误类型。
3. 把文档、对话、模型、RSS、复习、同步的数据模型集中到共享领域模块。
4. 创建 Web 工作区壳，复用现有 Vue 组件但移除扩展专属入口依赖。
5. 先接入文档列表和 URL 采集 API，再接入对话 API。

暂不在第一批实现：完整账户注册、云端队列、全部后端服务和一次性替换所有现有组件。每个领域必须先有接口契约和可验证的最小闭环。

## 13. 阻塞性决策

在 Phase 0 开始后端实现前必须确认：

1. 后端部署平台：Cloudflare Workers/D1/R2，还是 Node/PostgreSQL/S3。
2. 认证方式：邮箱密码、Magic Link、OAuth，还是已有账户系统。
3. AI 密钥归属：平台统一密钥、用户自带 Key，还是两者并存。
4. Web URL 抓取是否允许匿名试用，及 SSRF/robots 策略。
5. Web 是否必须支持离线阅读和离线复习。
6. 扩展是否保留为正式产品入口，还是仅作为过渡迁移工具。
7. 旧数据导入是否是上线阻塞项。

在这些决策明确前，不能可靠地把现有本地存储直接改成“云端同步”，也不能直接把模型配置暴露到 Web 浏览器。

## 14. 完成定义

迁移完成必须同时满足：

- Web 端具备登录、采集、阅读、记忆库、AI 对话、批量分析、RSS、复习、同步、模型和设置页面。
- 所有用户数据以账户为边界，跨浏览器和跨设备可恢复。
- 扩展采集能写入同一账户，且旧数据可导入。
- AI、网页抓取、RSS 和批量分析均由服务端任务或 API 提供可恢复状态。
- 浏览器不持有平台级 API Key，不直接访问供应商。
- 关键流程有自动化测试和数据备份/恢复验证。
- 删除账户后，文档、附件、对话、任务和同步副本按策略清理。
