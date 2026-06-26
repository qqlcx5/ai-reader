# VibeCoding Prompt: AI Reader Chrome Extension MV3

> **目标执行环境**: Claude Code
> **自动化程度**: 全自主 — 编码 → 测试 → 修复循环，直到全部通过。
> **参考项目**: `/Users/another/Documents/OpenSource/ai-reader/reference/obsidian-clipper`

---

## 0. 项目概述

**AI Reader** 是一个 Chrome Extension MV3，核心能力是捕获网页正文（通过 defuddle）、在侧边栏与 AI 对话、本地全文检索、时间轴浏览、WebDAV 同步。

### 技术栈

| 层级 | 选型 |
|------|------|
| 框架 | WXT + Vue 3 + TypeScript |
| 样式 | UnoCSS + Reka UI |
| 状态管理 | Pinia + chrome.storage.local 持久化 |
| 数据库 | Dexie.js + IndexedDB（3 表：documents / chatHistories / settings） |
| 内容提取 | defuddle（`defuddle/full` 导入 `createMarkdownContent`） |
| 流式通信 | eventsource-parser（OpenAI 兼容 `/v1/chat/completions`） |
| 搜索 | MiniSearch + Web Worker |
| 压缩 | CompressionStream('gzip')（原生）、lz-string（rawHtml 压缩） |
| 测试 | Vitest + jsdom |
| 代码高亮 | highlight.js |
| 净化 | DOMPurify |
| 日期 | dayjs |

### 架构分层

```
捕获层 (Perception) → 处理层 (Thinking) → 记忆层 (Persistence) → 唤醒层 (Awakening)
                         ↓
                  底座 (Foundation)
```

### 关键文档（需逐份通读）

- `doc/README.md` — 项目总览、架构、技术栈
- `doc/detail.md` — 详细技术架构（Mermaid 图、数据流、协议、目录结构、错误策略）
- `doc/tasks/progress.md` — 模块进度总览、依赖关系、里程碑
- `doc/tasks/foundation.md`
- `doc/tasks/perception.md`
- `doc/tasks/model-management.md`
- `doc/tasks/chat-with-doc.md`
- `doc/tasks/persistence.md`
- `doc/tasks/search.md`
- `doc/tasks/timeline.md`

### 参考项目

`/Users/another/Documents/OpenSource/ai-reader/reference/obsidian-clipper` 是功能和架构类似的 WXT + Vue Chrome Extension。所有任务文档中的"参考 xxx"均指该项目。实现前先阅读对应文件理解模式，不要复制粘贴，而是理解设计意图后自行实现。

---

## 1. 主 Agent 指令

你是本项目的主 Agent，负责全程编排，不直接写业务代码。

### 1.1 你的职责

1. **通读全部输入文档**：`doc/README.md`、`doc/detail.md`、`doc/tasks/*.md`、`doc/tasks/progress.md`
2. **探索参考项目**：浏览 `reference/obsidian-clipper` 的目录结构和关键文件，理解其 WXT 配置、组件结构、存储模式、消息通信方式
3. **按依赖顺序调度 7 个子 Agent**，每个子 Agent 负责一个模块的完整实现
4. **跟踪进度**：每完成一个模块，更新 `doc/tasks/progress.md` 中对应模块的状态为 ✅
5. **验收把关**：子 Agent 返回后，验证其产出（文件是否存在、测试是否通过、验收标准是否满足）
6. **失败处理**：若子 Agent 测试未通过或验收不满足，将失败信息反馈给子 Agent 要求修复，最多重试 3 次；3 次后暂停并报告阻塞点

### 1.2 执行顺序（严格串行，依赖决定）

```
Step 1: Foundation     (P0, 无依赖)
Step 2: Perception     (P0, 依赖 Foundation)
Step 3: Model Mgmt     (P0, 依赖 Foundation)
Step 4: Chat with Doc  (P0, 依赖 Foundation + Perception + Model Mgmt)
Step 5: Persistence    (P1, 依赖 Foundation + Perception)
Step 6: Search         (P1, 依赖 Foundation + Perception)
Step 7: Timeline       (P2, 依赖 Foundation + Perception)
```

### 1.3 子 Agent 派发方式

使用 Claude Code 的 Task 工具（task 委托）派发每个模块。每次派发时：

- **task 描述**必须包含：
  - 模块名称和目标
  - 需要阅读的文档路径
  - 依赖模块的已完成文件清单（前序模块产出的关键文件路径）
  - 参考项目中的相关文件路径
  - 完整的任务清单（从对应 `tasks/*.md` 中提取）
  - 测试要求
  - 验收标准

- 传入前序模块已生成的**关键文件路径清单**，确保子 Agent 能直接引用（如接口定义、Dexie 实例、消息类型等）

### 1.4 进度追踪

每完成一个模块后，用 `edit_file` 更新 `doc/tasks/progress.md`：
- 将模块状态从 `⬜ 未开始` 改为 `✅ 已完成`
- 勾选该模块的所有 checkbox（`- [ ] ` → `- [x] `）
- 在"最近更新"区域追加一条记录

### 1.5 停止条件

全部 7 个模块通过验收后，输出最终总结报告，包含：
- 各模块完成状态
- 测试覆盖率概要
- 已知技术债务或后续优化建议

---

## 2. 子 Agent 任务定义

### 2.1 Foundation 子 Agent（底座：MV3 框架 + IndexedDB 数据层）

**注意：IndexedDB 数据层搭建已从 Persistence 模块提升到本模块，因为 P0 模块（Perception、Chat）依赖它。**

#### 需要阅读的文档
- `doc/tasks/foundation.md`（原有任务）
- `doc/detail.md` 第 2、6、11、14 节（运行时架构、数据模型、目录结构、WXT 配置）
- `doc/README.md` 第 1、2.4、4.1 节

#### 参考项目关键文件
- `reference/obsidian-clipper/wxt.config.ts`
- `reference/obsidian-clipper/package.json`
- `reference/obsidian-clipper/src/` 目录结构
- `reference/obsidian-clipper/src/storage-utils.ts`（存储模式）
- `reference/obsidian-clipper/src/browser-polyfill.ts`（通信封装）
- `reference/obsidian-clipper/src/types/types.ts`（类型定义风格）

#### 任务清单

**A. 项目初始化**
1. 用 `npm create wxt@latest` 初始化 WXT + Vue + TS 项目
2. 安装所有依赖：`vue`, `vue-router`, `pinia`, `pinia-plugin-persistedstate`, `dexie`, `defuddle`, `dayjs`, `lz-string`, `minisearch`, `eventsource-parser`, `highlight.js`, `dompurify`, `lucide-vue-next`
3. 安装开发依赖：`vitest`, `jsdom`, `@wxt-dev/module-vue`, `unocss`, `@unocss/preset-uno`, `eslint`, `prettier`
4. 配置 `wxt.config.ts`：
   - `modules: ['@wxt-dev/module-vue']`
   - `manifest.permissions: ['sidePanel', 'storage', 'activeTab']`
   - `manifest.side_panel.default_path: 'entrypoints/sidepanel/index.html'`
5. 验证 `npm run build` 无错误

**B. 目录结构初始化**
严格按照 `doc/detail.md` 第 11 节创建完整目录树：
- `entrypoints/background.ts`
- `entrypoints/content.ts`
- `entrypoints/sidepanel/`（index.html, main.ts, App.vue, pages/ChatPage.vue, pages/SearchPage.vue, pages/TimelinePage.vue）
- `entrypoints/options/`（index.html, main.ts, App.vue, ModelSettings.vue, WebDAVSettings.vue, PromptSettings.vue）
- `components/`（共享组件）
- `core/documents/`, `core/chat/`, `core/models/`, `core/sync/`, `core/search/`, `core/timeline/`
- `db/`（dexie.ts, schema.ts, migrations.ts）
- `workers/search.worker.ts`
- `shared/messaging/`, `shared/crypto/`, `shared/utils/`

**C. IndexedDB 数据层（⚠️ 从 Persistence 模块移入）**
1. `db/schema.ts`：定义所有 TypeScript 接口
   - `CapturedDocument`（id, title, url, author?, publishedAt?, favicon?, description?, keywords?, markdownContent, rawHtml?, siteName?, image?, wordCount?, language?, schemaOrgData?, createdAt, updatedAt）
   - `ChatHistory`（id, documentId, modelId, model, messages[], createdAt, updatedAt）
   - `SettingsEntry`（key, value, updatedAt）
   - `ModelProviderConfig`（id, name, provider, enabled, apiKey, baseUrl, model, systemPrompt?, createdAt, updatedAt）
2. `db/dexie.ts`：
   ```ts
   db.version(1).stores({
     documents: 'id, url, title, createdAt, updatedAt',
     chatHistories: 'id, documentId, createdAt, updatedAt',
     settings: 'key, updatedAt'
   });
   ```
3. `db/migrations.ts`：`schemaVersion` 常量 + 迁移策略骨架
4. 实现 Repository 层：
   - `core/documents/document.repository.ts`（CRUD + 按 URL/日期查询）
   - `core/chat/chat.repository.ts`（CRUD + 按 documentId 查询）
   - `core/models/model.repository.ts`（CRUD + 查询启用列表）

**D. 样式系统**
1. 安装并配置 UnoCSS（`uno.config.ts`），颜色主题必须对齐 `doc/design.html` 设计稿：
   - `brand` 色系（靛蓝 indigo）：`brand-50: #f5f3ff` ~ `brand-900: #312e81`，主色 `brand-500: #6366f1`
   - `slate` 色系（标准 slate）：`slate-50: #f8fafc` ~ `slate-900: #0f172a`
   - 字体：Inter（sans）、JetBrains Mono（mono）
2. 安装 Reka UI（无样式 UI 原语）。**所有交互组件必须基于 Reka UI 原语二次封装**，禁止使用原生 HTML 标签（`<button>`、`<input>`、`<select>`、`<dialog>`、`<textarea>` 等）直接编写 UI：
   - 按钮 → 封装 `BaseButton.vue`（基于 Reka UI `Button` 或自行封装可访问性属性）
   - 输入框 → 封装 `BaseInput.vue`（基于 Reka UI 原语，统一 focus/error/disabled 样式）
   - 下拉选择 → 使用已有的 `ModelSelector.vue` 模式（Reka UI `Select*` 系列原语）
   - 弹窗/对话框 → 封装 `BaseDialog.vue`（基于 Reka UI `Dialog*` 系列原语）
   - 标签页 → 封装 `BaseTabs.vue`（基于 Reka UI `Tabs*` 系列原语）
   - 开关 → 封装 `BaseSwitch.vue`（基于 Reka UI `Switch` 原语）
   - 所有封装组件放在 `components/ui/` 目录，通过 UnoCSS utility class + `card`/`input`/`btn-primary` 等 shortcuts 应用样式
3. 配置基础样式变量（颜色、间距、字体），参考 `doc/design.html` 的视觉规范（圆角、阴影、边框、间距）
4. 支持暗色/亮色模式切换

**E. 状态管理**
1. 配置 Pinia + `pinia-plugin-persistedstate`
2. 实现 `chrome.storage.local` 序列化器
3. 创建 Store：
   - `useDocumentStore`（当前文档、文档列表）
   - `useChatStore`（对话状态、消息列表）
   - `useSearchStore`（搜索结果、索引状态）
   - `useSyncStore`（同步状态、配置）
   - `useSettingsStore`（模型配置、WebDAV 配置）

**F. 跨上下文通信**
1. `shared/messaging/messages.ts`：定义所有消息类型枚举（`CAPTURE_PAGE`, `START_CHAT`, `STREAM_DELTA`, `STREAM_DONE`, `STREAM_ERROR`, `SEARCH_QUERY`, `SYNC_UPLOAD`, `SYNC_DOWNLOAD` 等）
2. `shared/messaging/runtime-client.ts`：封装 `chrome.runtime.sendMessage` 和 `chrome.runtime.onMessage`，Promise 化，统一错误处理

**G. 图标与资源**
1. 准备 icon-16.png, icon-48.png, icon-128.png
2. 配置 manifest 图标路径

**H. 开发工具**
1. 配置 Vitest + jsdom
2. 配置 ESLint + Prettier
3. 配置 TypeScript 严格模式
4. 配置路径别名（`@/core`, `@/db`, `@/shared`）

**I. 构建与打包**
1. 配置生产构建脚本
2. 生成 .zip 文件用于 Chrome Web Store 提交
3. 验证 manifest 字段完整性

#### 测试要求
- 为 `db/schema.ts` 和 `db/dexie.ts` 编写单元测试（表创建、索引验证）
- 为每个 Repository 编写 CRUD 测试（使用 Dexie 的 fake-indexeddb 或 jsdom 模拟）
- 为 `runtime-client.ts` 编写消息收发测试（mock `chrome.runtime` API）
- 为 Pinia Store 编写状态变更测试

#### 验收标准
- `npm run dev` 热更新正常
- `npm run build` 无错误，生成可加载的扩展包
- `npm run test` 全部通过
- Side Panel 可正常打开
- Content Script 在任意页面可注入
- IndexedDB 三张表 CRUD 正常

---

### 2.2 Perception 子 Agent（捕获层：网页解析与数据提取）

#### 前提依赖
Foundation 模块已完成，以下文件可用：
- `db/dexie.ts`, `db/schema.ts`
- `core/documents/document.repository.ts`
- `shared/messaging/messages.ts`, `shared/messaging/runtime-client.ts`
- `entrypoints/background.ts`（消息路由骨架）

#### 需要阅读的文档
- `doc/tasks/perception.md`
- `doc/detail.md` 第 1、2、3 节（架构图、运行时架构、捕获层数据流）
- `doc/README.md` 第 2.1 节

#### 参考项目关键文件
- `reference/obsidian-clipper/src/content.ts`
- `reference/obsidian-clipper/src/content-extractor.ts`
- `reference/obsidian-clipper/src/shared.ts`
- `reference/obsidian-clipper/src/types/types.ts`

#### 任务清单
1. Content Script 入口搭建（`matches: ['<all_urls>']`, `world: 'MAIN'`）
2. 注入悬浮捕获按钮 + 绑定点击事件
3. defuddle 集成：从 `defuddle/full` 导入 `createMarkdownContent()`，在 Content Script 中 clone document 并调用 `defuddle.parseAsync()`
4. 元数据提取：title, url, author, publishedAt, favicon, description, keywords, siteName, image, wordCount, language, schemaOrgData
5. 捕获结果标准化（生成 id、填充时间戳、组装 `CapturedDocument`）
6. 降级处理：defuddle 解析失败时回退到 `document.body.innerText` + 简单 Markdown 转换
7. 跨上下文通信：Content Script → Background（`CAPTURE_PAGE` 消息）
8. Background 接收消息 → 调用 `documentRepository.put(document)` 持久化
9. Background 通知 Search Worker 索引更新（Worker 此时尚未存在，消息发送允许失败，不阻塞主流程）
10. Background 调用 `chrome.sidePanel.open({ tabId })` 打开 Side Panel 并传入 `documentId`

#### 测试要求
- defuddle 解析单元测试（使用 fixtures 样本 HTML，验证 Markdown 输出和元数据提取）
- 降级策略测试（defuddle 失败时回退逻辑）
- 跨上下文通信测试（mock `chrome.runtime.sendMessage`）
- 持久化流程测试（验证 `CapturedDocument` 正确写入 IndexedDB）

#### 验收标准
- 任意网页点击悬浮按钮后，3 秒内完成捕获并展示在 Side Panel
- 元数据提取完整度 ≥ 80%（主流新闻/博客/文档站点）
- 解析失败时有降级，不阻塞流程
- `npm run test` 全部通过

---

### 2.3 Model Management 子 Agent（处理层：多模型配置管理）

#### 前提依赖
Foundation 模块已完成，以下文件可用：
- `db/dexie.ts`, `db/schema.ts`
- `core/models/model.repository.ts`
- `shared/messaging/messages.ts`
- `entrypoints/options/`（骨架已创建）

#### 需要阅读的文档
- `doc/tasks/model-management.md`
- `doc/detail.md` 第 1、2、4 节（架构图、OpenAI 兼容流式对话架构、模型配置结构）
- `doc/README.md` 第 2.2、4.1 节

#### 参考项目关键文件
- `reference/obsidian-clipper/src/managers/general-settings.ts`
- `reference/obsidian-clipper/src/managers/interpreter-settings.ts`
- `reference/obsidian-clipper/src/interpreter.ts`（LLM 请求和 Ping 逻辑）
- `reference/obsidian-clipper/src/settings.html`

#### 任务清单
1. `core/models/openai-compat.adapter.ts`：统一 OpenAI 兼容 Adapter
   - `ping(baseUrl, apiKey, model)`: 发送最小请求（`max_tokens: 1`），返回成功/失败/超时（30s）
   - `streamChat(baseUrl, apiKey, model, messages, systemPrompt?)`: 发起流式请求，返回 ReadableStream
2. `entrypoints/options/ModelSettings.vue`：模型配置 UI
   - 模型列表（名称、Base URL、模型 ID、启用状态）
   - 添加/编辑/删除模型表单
   - 启用/禁用开关
   - 设置默认模型（单选）
3. `shared/crypto/secret-store.ts`：API Key 存储
   - 使用 `chrome.storage.local` 存储
   - 输入框类型 `password`，支持显示/隐藏切换
4. Ping 测试功能：UI 展示连接状态（绿/红/黄指示灯）
5. `entrypoints/options/PromptSettings.vue`：系统提示词配置
   - 全局默认提示词编辑（textarea）
   - 按模型单独配置（覆盖全局）
   - 模板变量支持（`{{date}}`、`{{url}}`、`{{title}}` 等）
6. `components/ModelSelector.vue`：共享的模型选择器下拉组件
   - 只显示启用模型
   - 显示模型名称 + 提供商简称

#### 测试要求
- `openai-compat.adapter.ts` 单元测试（mock fetch，验证请求体格式、流式解析、Ping 逻辑）
- `model.repository.ts` CRUD 测试（已有骨架，补充完整）
- ModelSettings.vue 组件测试（表单交互、添加/删除模型流程）
- ModelSelector.vue 组件测试（过滤启用模型、选择事件）

#### 验收标准
- 可配置 ≥3 个不同供应商模型（DeepSeek/通义/OpenRouter）
- API Key 不以明文暴露在 UI（input type="password"）
- Ping 测试 3 秒内返回结果
- 禁用模型不出现在 Chat 模型选择器中
- 系统提示词修改后即时生效
- `npm run test` 全部通过

---

### 2.4 Chat with Doc 子 Agent（处理层：沉浸式侧边栏对话）

#### 前提依赖
Foundation、Perception、Model Management 已完成，以下文件可用：
- `core/models/openai-compat.adapter.ts`
- `db/dexie.ts`, `db/schema.ts`
- `core/documents/document.repository.ts`
- `core/chat/chat.repository.ts`
- `core/models/model.repository.ts`
- `entrypoints/sidepanel/`（骨架已创建）
- `components/ModelSelector.vue`

#### 需要阅读的文档
- `doc/tasks/chat-with-doc.md`
- `doc/detail.md` 第 1、2、4、5 节（架构图、流式对话架构、Chat with Doc 时序图）
- `doc/README.md` 第 2.3 节

#### 参考项目关键文件
- `reference/obsidian-clipper/src/interpreter.ts`（LLM 请求模式）
- `reference/obsidian-clipper/src/popup.ts`（UI 渲染模式）
- `reference/obsidian-clipper/src/utils/renderer.ts`（Markdown 渲染）
- `reference/obsidian-clipper/src/side-panel.html`

#### 任务清单
1. `entrypoints/sidepanel/pages/ChatPage.vue`：主布局
   - 顶部文档摘要区（标题、URL、字数、元数据折叠）
   - 中部消息列表（用户消息气泡右对齐、AI 消息气泡左对齐）
   - 底部输入框（textarea + 发送按钮，Enter 发送，Shift+Enter 换行）
   - 模型选择器集成（ModelSelector 组件）
2. `core/chat/prompt-builder.ts`：
   - 组装消息数组：`[systemPrompt, {role: 'user', content: docMarkdown + question}]`
   - 系统提示词优先级：模型专属 > 全局默认 > 内置默认
   - 上下文截断策略（超长文档保留前 N tokens）
3. Background 中实现 `startChatStream(documentId, question, modelId)`：
   - 调用 `openai-compat.adapter.ts` 的 `streamChat()`
   - 使用 `eventsource-parser` 解析 SSE chunks
   - 通过 `chrome.runtime.connect` 长连接转发 delta 到 Side Panel
4. `components/StreamMessage.vue`：流式消息气泡
   - 实时追加 delta content
   - 打字机效果 + 平滑滚动
   - 支持中断按钮（AbortController）
5. `components/MarkdownRenderer.vue`：Markdown 渲染
   - DOMPurify 净化 HTML
   - highlight.js 代码块语法高亮
   - 链接可点击（新开标签页）
   - 表格样式
   - 图片懒加载
6. Chat 历史管理：
   - 流式完成后保存完整对话到 `chatHistories` 表
   - 页面加载时读取历史消息
   - 支持清空当前对话
7. 对话状态管理：idle / loading / streaming / error + 重试逻辑

#### 测试要求
- `prompt-builder.ts` 单元测试（消息数组组装、截断策略、提示词优先级）
- `eventsource-parser` 集成测试（模拟 SSE 数据流，验证中文无乱码/截断）
- `ChatPage.vue` 组件测试（消息发送、流式渲染、中断）
- `MarkdownRenderer.vue` 组件测试（代码高亮、链接、表格、XSS 防护）
- `chat.repository.ts` CRUD 测试

#### 验收标准
- 输入问题后 1 秒内开始流式输出（网络正常）
- 中文 SSE 无乱码、无截断
- Markdown 渲染正确（代码块、列表、链接、表格）
- 对话历史持久化，刷新页面后可恢复
- 支持中断生成，中断后 UI 状态正确
- `npm run test` 全部通过

---

### 2.5 Persistence 子 Agent（记忆层：本地存储与同步）

#### 前提依赖
Foundation、Perception 已完成。**IndexedDB 数据层已在 Foundation 中完成**，本模块聚焦于压缩、导入导出、WebDAV 同步。

#### 需要阅读的文档
- `doc/tasks/persistence.md`（注意：跳过第 1 节"IndexedDB 数据层搭建"，该任务已在 Foundation 完成）
- `doc/detail.md` 第 1、2、6、7 节（架构图、数据模型、WebDAV 同步架构）
- `doc/README.md` 第 2.4 节

#### 参考项目关键文件
- `reference/obsidian-clipper/src/import-export.ts`
- `reference/obsidian-clipper/src/file-utils.ts`
- `reference/obsidian-clipper/src/modal-utils.ts`

#### 任务清单
1. **大字段压缩**：安装 `lz-string`
   - 写入 `rawHtml` 时 `LZString.compressToUTF16()`
   - 读取时 `LZString.decompressFromUTF16()`
   - 在 `document.repository.ts` 中透明集成（更新 Foundation 产出的 Repository）
2. **手动导出**：`core/sync/backup-packager.ts`
   - 读取 documents + chatHistories + settings 全量
   - 打包为 `ReadChat_backup.json`（含 schemaVersion, documents, chatHistories, settings, exportedAt, version）
   - 触发浏览器下载
   - Side Panel / Options 添加"导出备份"按钮
3. **手动导入**：
   - 文件选择（`<input type="file" accept=".json">`）
   - 解析 JSON + 校验 schemaVersion
   - 版本不兼容时拒绝导入并提示
   - 导入前提示"将覆盖本地数据，是否先导出备份？"
   - 使用 `db.bulkPut()` 写入数据
   - 导入完成后通知重建搜索索引
4. **WebDAV 配置**：`entrypoints/options/WebDAVSettings.vue`
   - 表单：服务器地址、用户名、密码、远程目录
   - 测试连接按钮（PROPFIND 根目录）
   - 密码加密存储
5. **WebDAV 上传**：`core/sync/webdav-client.ts` + `core/sync/sync.service.ts`
   - `mkcol(path)`, `put(path, data)`, `get(path)`, `propfind(path)`
   - `syncUpload()`：读取全量 → 打包 ReadChat_data.json → 生成 metadata.json → CompressionStream('gzip') 压缩 → PUT
6. **WebDAV 拉取**：`syncDownload()`
   - GET metadata.json → 比较 updatedAt
   - 远端更新时：保存本地快照 → 下载 → 解压 → 校验 schema → clear + bulkPut → 更新 lastSyncAt → 重建搜索索引
   - 本地最新时提示
   - 冲突时提示"远端将覆盖本地"
7. **同步状态管理**：idle / syncing / success / error

#### 测试要求
- lz-string 压缩/解压测试（往返一致性）
- `backup-packager.ts` 单元测试（打包格式验证、schemaVersion 正确）
- 导入流程测试（JSON 解析、schema 校验、版本不兼容拒绝）
- WebDAV client mock 测试（PUT/GET/PROPFIND 请求正确性）
- 同步冲突场景测试（远端 vs 本地 updatedAt 比较逻辑）

#### 验收标准
- 导出 JSON 可在新浏览器完整导入恢复
- WebDAV 上传/下载数据包不崩溃
- 同步冲突时用户有明确选择，不丢失数据
- 压缩后数据包体积减少 ≥ 50%
- `npm run test` 全部通过

---

### 2.6 Search 子 Agent（唤醒层：本地全文检索）

#### 前提依赖
Foundation、Perception 已完成，以下文件可用：
- `db/dexie.ts`, `db/schema.ts`
- `core/documents/document.repository.ts`
- `workers/search.worker.ts`（骨架）
- `entrypoints/sidepanel/pages/SearchPage.vue`（骨架）

#### 需要阅读的文档
- `doc/tasks/search.md`
- `doc/detail.md` 第 1、2、3、8 节（架构图、运行时架构、搜索 Worker 架构）
- `doc/README.md` 第 2.5 节

#### 任务清单
1. 安装 `minisearch`
2. `workers/search.worker.ts`：完整实现
   - Worker 内独立创建 Dexie 实例读取 documents 表
   - `INIT_INDEX`：启动时全量 `addDocuments()`
   - `UPSERT_DOCUMENT`：单篇 `addDocument()` / `replace()`
   - `REMOVE_DOCUMENT`：单篇 `remove()`
   - `SEARCH`：执行 `search(query)` 并返回结果
3. `core/search/search.client.ts`：主线程搜索客户端
   - 封装 Worker 通信（postMessage/onmessage）
   - `search(query)` 返回 Promise
   - `upsert(documentId)` / `remove(documentId)` API
   - 监听 `INDEX_READY` 事件
   - Worker 错误处理和重启
4. `entrypoints/sidepanel/pages/SearchPage.vue`：
   - 搜索输入框（实时搜索，防抖 300ms）
   - 结果列表（标题 + 摘要 + 日期，高亮匹配关键词）
   - 点击结果跳转 Chat 页面
   - 空状态 / 加载状态
5. 索引增量更新：Background 在文档捕获/删除后通知 Worker
6. 降级策略：MiniSearch 失败时降级为 Dexie `where('title').startsWith(query)`

#### MiniSearch 配置
```ts
const miniSearch = new MiniSearch({
  fields: ['title', 'markdownContent'],
  storeFields: ['id', 'title', 'url', 'createdAt'],
  searchOptions: {
    boost: { title: 3, markdownContent: 1 },
    fuzzy: 0.2,
    prefix: true
  }
});
```

#### 测试要求
- Worker 消息协议测试（INIT_INDEX, UPSERT, REMOVE, SEARCH 消息格式）
- MiniSearch 索引测试（全量重建、增量更新、搜索结果排序权重验证）
- `search.client.ts` 单元测试（mock Worker，验证通信协议）
- SearchPage.vue 组件测试（输入防抖、结果渲染、高亮）
- 降级策略测试（MiniSearch 失败时 fallback 到 Dexie）

#### 验收标准
- 万级文档全量索引重建 < 1s
- 搜索响应 < 100ms（主线程无阻塞）
- 增量更新 < 10ms（单篇）
- 标题匹配权重高于正文
- 索引失败不影响主流程，有降级方案
- `npm run test` 全部通过

---

### 2.7 Timeline 子 Agent（唤醒层：历史时间轴）

#### 前提依赖
Foundation、Perception 已完成，以下文件可用：
- `db/dexie.ts`, `db/schema.ts`
- `core/documents/document.repository.ts`
- `entrypoints/sidepanel/pages/TimelinePage.vue`（骨架）

#### 需要阅读的文档
- `doc/tasks/timeline.md`
- `doc/detail.md` 第 1、2、9 节（架构图、时间轴架构）
- `doc/README.md` 第 2.6 节

#### 任务清单
1. `core/timeline/timeline.service.ts`：
   - 按 `createdAt` 聚合 documents（日/周/月维度）
   - 使用 Dexie `orderBy('createdAt')` 读取
   - 聚合性能：万级文档 < 100ms
2. `entrypoints/sidepanel/pages/TimelinePage.vue`：
   - 贡献热力图（每个格子代表一天，颜色深浅表示捕获量）
   - 时间范围筛选器（日/周/月）
   - 月份标签（X 轴）、星期标签（Y 轴）
3. 日期详情弹窗：
   - 点击某一天弹出当天文档列表
   - 列表项显示标题 + URL + 捕获时间
   - 点击跳转 Chat 页面
4. 统计信息展示：
   - 总捕获数、今日捕获数、本周捕获数
   - 连续捕获天数（Streak）
   - 最活跃的一天
5. 数据刷新：进入页面时重新聚合 + 捕获新文档后自动刷新

#### 测试要求
- `timeline.service.ts` 单元测试（日/周/月聚合逻辑正确性）
- 聚合性能测试（万级文档 benchmark）
- TimelinePage.vue 组件测试（热力图渲染、日期点击弹窗）
- 统计信息计算测试（Streak 逻辑、总数验证）

#### 验收标准
- 热力图渲染流畅，无卡顿
- 万级文档聚合 < 100ms
- 点击日期 3 秒内展示文档列表
- 统计信息实时准确
- `npm run test` 全部通过

---

## 3. 跨模块通用约束

### 3.1 代码质量标准
- TypeScript 严格模式（`strict: true`），所有函数标注返回类型
- 禁止 `any` 类型（除非确实无法推断且有注释说明）
- 组件使用 `<script setup lang="ts">`
- 文件名：组件 PascalCase，工具/服务 kebab-case，类型文件 `*.types.ts`

### 3.2 UI 组件规范
- **设计稿参照**：所有 UI 必须对齐 `doc/design.html` 的视觉规范，不得自行发挥颜色、间距、圆角
- **组件库**：交互元素（按钮、输入、选择、弹窗、开关、标签页等）必须基于 Reka UI 原语二次封装，封装组件统一放在 `components/ui/` 目录
- **禁止原生标签写 UI**：不得直接使用 `<button>`、`<input>`、`<select>`、`<dialog>`、`<textarea>` 等原生标签作为交互入口，必须通过封装后的组件使用
- **颜色体系**：只使用 UnoCSS 主题中定义的 `brand-*` 和 `slate-*` 色值，禁止使用 `gray-*`、`blue-*`、`sky-*` 等非主题色
- **已有组件**：`ModelSelector.vue`（Reka UI Select）、`components/ui/` 下的基础组件。复用已有组件，不要重复造轮子

### 3.3 测试标准
- 每个模块的测试文件放在模块目录内或项目统一的 `tests/` 目录
- 测试覆盖核心逻辑和边界条件
- 使用 `vitest` 运行，配置中启用 `jsdom` 环境
- mock `chrome.*` API 在 `vitest.setup.ts` 中统一配置

### 3.4 错误处理
遵循 `doc/detail.md` 第 15 节的错误处理策略表。关键场景：
- defuddle 解析失败 → 回退 innerText
- LLM 超时 → 展示超时提示，允许重试
- SSE 断开 → 保留已接收内容，标记"回复中断"
- IndexedDB 满 → 捕获 QuotaExceededError，提示清理
- 搜索索引失败 → 降级 Dexie 简单匹配

### 3.5 禁止行为
- 不得复制粘贴参考项目代码，必须理解后自行实现
- 不得跳过测试
- 不得在验收标准未满足时报告完成
- 不得修改其他模块的文件（除非是修复被要求修复的 bug）
