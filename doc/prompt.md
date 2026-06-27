# AuraMind VibeCoding Master Prompt

> 目标执行环境：Claude Code（主 Agent 编排 + 子 Agent 逐模块执行）
> 全过程自动化，无人为介入。每个模块完成后自动验证（构建 + 测试）。

---

## 1. 项目概述

**AuraMind** 是一款 Chrome 浏览器扩展（Side Panel），核心工作流：**抓取当前网页内容 → AI 分析/对话 → 本地知识库管理**。用户打开侧边栏后自动获取页面正文，选择 AI 模型进行流式对话或摘要，所有文档和对话持久化到本地 IndexedDB。

### 1.1 技术栈

| 层 | 选型 |
|---|---|
| 框架 | WXT 0.20 + Vue 3.5 + TypeScript 5.9 |
| 样式 | UnoCSS (presetWind3) |
| 组件库 | reka-ui 2.10（必须通过 `components/ui/` 封装间接使用，禁止直接 import reka-ui） |
| 图标 | @lucide/vue |
| 状态管理 | Pinia 3 + pinia-plugin-persistedstate |
| 数据库 | Dexie 4（IndexedDB wrapper） |
| 网页抓取 | defuddle 0.19 + DOMPurify |
| 流式通信 | eventsource-parser 3 |
| 搜索 | MiniSearch 7 |
| 代码高亮 | highlight.js 11 |
| 压缩 | lz-string |
| 包管理器 | pnpm |

### 1.2 项目根目录

```
/Users/another/Documents/OpenSource/ai-reader
```

### 1.3 目录结构约定（无 `src/` 前缀）

```
components/          # 所有 Vue 组件
  ui/                # reka-ui 封装组件（已存在）
  common/            # 通用业务组件（已存在部分）
  auramind/          # 设计稿业务组件（已存在 10 个）
  views/             # 视图入口组件（已存在）
  layout/            # 布局组件（已存在）
  workspace/         # Workspace 子组件（待创建）
  settings/          # Settings 子组件（待创建）
  library/           # Library 子组件（待创建）
entrypoints/         # WXT 入口
  background.ts      # 已存在
  content.ts         # 已存在（stub）
  sidepanel/         # 待创建
stores/              # Pinia stores（待创建）
db/                  # Dexie schema + repositories（待创建）
services/            # 业务服务层（待创建）
  ai/                # AI Provider 适配
  prompt/            # Prompt 构建
  search/            # MiniSearch 搜索
```

### 1.4 关键约束（不可违反）

1. **样式不可重构**：`components/ui/`、`components/auramind/`、`components/views/`、`components/common/`、`components/layout/` 下所有已有组件的样式（class、布局、颜色）一律不动，只能新增功能逻辑，禁止修改 UnoCSS class、禁止调整布局结构、禁止更改颜色/间距/字体。
2. **reka-ui 必须走 UI 封装**：所有 reka-ui 组件（Switch、Slider、Select、Separator 等）的 import 只能出现在 `components/ui/` 目录内。业务组件引用 `components/ui/` 中的封装组件，禁止直接 `import { ... } from 'reka-ui'`。**已有违反此规则的组件（如 `components/views/AIView.vue` 直接 import reka-ui Select）需在对应模块中修正。**
3. **路径不加 `src/` 前缀**：所有文件路径从项目根开始，如 `components/ui/Switch.vue`、`stores/chat.store.ts`。

### 1.5 参考项目

`reference/obsidian-clipper` — 同为 Chrome 扩展，使用 defuddle 抓取 + content script 通信。参考其 content script 架构和 defuddle 调用模式，但不照搬代码。

---

## 2. 总架构：主 Agent + 子 Agent

### 2.1 主 Agent（Orchestrator）职责

1. **环境就绪检查**：运行 `pnpm install` 确保依赖完整；检查 `wxt.config.ts` / `uno.config.ts` 是否就绪。
2. **按依赖顺序调度子 Agent**：严格遵循 §3 的模块执行顺序，前一模块**构建 + 测试通过**后才启动下一模块。
3. **进度追踪**：每完成一个模块，更新 `doc/tasks/progress.md` 中对应模块状态为「✅ 已完成」并填入日期。
4. **最终全量验证**：所有模块完成后，依次运行 `pnpm vue-tsc --noEmit`、`pnpm vitest run`、`pnpm build`，三项全部通过才算完成。
5. **失败处理**：子 Agent 返回失败时，主 Agent 分析原因并重新派发（最多重试 2 次），超限后终止并输出问题摘要。

### 2.2 子 Agent 协议

每个子 Agent 接收以下输入：

- **模块名称**：如 `ext-foundation`
- **项目根目录**：`/Users/another/Documents/OpenSource/ai-reader`
- **需读取的文档**：`doc/detail.md`（相关章节）+ 本模块的 `doc/tasks/{module}.md`
- **需参考的代码**：`reference/obsidian-clipper/src/`（仅 web-capture 模块）
- **待完成任务清单**（见 §4 各模块详情）
- **技术约束**：§1.4 的三条不可违反约束 + 模块特定约束
- **验收标准**：完成所有子任务 + 通过 §5 的测试标准

子 Agent 完成后的输出要求：

- 列出所有新建/修改的文件路径
- 报告测试结果（通过/失败数量）
- 如有阻塞点，明确描述

---

## 3. 模块依赖与执行顺序

```
Phase 1: ext-foundation（含 data-layer store 完整实现）
    ↓
Phase 2: app-shell ──────────────────────┐
    ↓                                     │
Phase 3: web-capture                      │
    ↓                                     │
Phase 4: context-preview                  │
                                          │
Phase 5: model-config ←───────────────────┘
    ↓
Phase 6: ai-provider
    ↓
Phase 7: ai-chat
    ↓
Phase 8: library-search
    ↓
Phase 9: settings-management
    ↓
Phase 10: data-layer（Repository 抽象层补全与优化）
```

关键依赖说明：

- `app-shell` 依赖 `ext-foundation` 的 Pinia stores 和 WXT 工程
- `web-capture` 依赖 `ext-foundation` 的 `documentStore` 和通信基座
- `context-preview` 依赖 `web-capture` 的抓取结果结构
- `model-config` 依赖 `ext-foundation` 的 `modelStore` 和 UI 组件
- `ai-provider` 依赖 `model-config` 的 `ModelConfig` 类型定义
- `ai-chat` 依赖 `ai-provider` + `web-capture`（需真实 Store）
- `library-search` 依赖 `ext-foundation`（Dexie + documentStore）
- `settings-management` 依赖 `ext-foundation`（settingsStore）
- `data-layer` 依赖所有前置模块，做最终抽象优化

---

## 4. 模块详细定义

### Phase 1 — ext-foundation（插件基础 + 数据层 Store）

**目标**：建立完整可运行的 WXT 工程骨架，实现所有 Pinia Store（含完整 actions 和 Repository 调用），让后续模块可以直接依赖真实的业务状态。

**前提**：`pnpm install` 已就绪，`wxt.config.ts` / `uno.config.ts` / `package.json` 已存在。

**任务**：

1. **修复 WXT 配置**：`wxt.config.ts` 补充 `permissions: ['sidePanel', 'activeTab', 'scripting', 'storage', 'tabs']` 和 `host_permissions: ['<all_urls>']`
2. **创建 sidepanel 入口**：`entrypoints/sidepanel/index.html`、`main.ts`、`App.vue`
   - App.vue 挂载 Pinia，渲染 TopBar + 三视图容器（v-show 切换）
3. **Dexie 数据库初始化**：`db/schema.ts` 定义 v1 stores + `db/index.ts` 导出 db 实例
   - 表：`documents`（索引 `id, url, canonicalUrl, title, siteName, capturedAt, updatedAt, lastOpenedAt, contentHash`）、`conversations`（索引 `id, documentId, createdAt, updatedAt`）、`models`（索引 `id, provider, modelId, enabled, isDefault, updatedAt, lastUsedAt`）、`settings`（索引 `id, updatedAt`）
4. **Repository 基础实现**：`db/repositories/` 下创建 `document.ts`、`conversation.ts`、`model.ts`、`settings.ts`
   - 每个 Repository 实现基本 CRUD：`create`、`findById`、`update`、`delete`、`count`
   - ModelRepository 额外实现 `findEnabled`、`findDefault`、`setDefault`
   - SettingsRepository 为单例模式
5. **Pinia Stores 完整实现**：`stores/` 下创建并完整实现 6 个 store
   - `app.store.ts`：`currentView` / `activeTab` / `showPageChangeTip` / `toasts` + 完整 actions
   - `workspace.store.ts`：`workspaceTab` / `contextTab` / `documentSource` / `extractionStatus` + actions
   - `document.store.ts`：`currentDocument` / `extractionStatus` + `extractCurrentPage` / `loadDocument` / `saveDocument` / `deleteDocument`（含 Repository 调用）
   - `chat.store.ts`：`currentConversation` / `inputText` / `isStreaming` + `sendMessage` / `stopGeneration` / `regenerate`（含 Repository 调用）
   - `model.store.ts`：`models` / `currentModelId` + 完整 CRUD + `toggleEnabled` / `setDefault` / `testConnection`（含 Repository 调用）
   - `settings.store.ts`：`globalSystemPrompt` / `context` / `capture` + `save`（含 Repository 调用）
6. **更新 content.ts**：将 `matches` 改为 `['<all_urls>']`
7. **background.ts 补充通信**：实现 `browser.runtime.onMessage` 路由骨架

**验收**：`pnpm build` 无报错，Chrome 可加载扩展，Side Panel 打开显示空白占位。

---

### Phase 2 — app-shell（App Shell + 导航）

**目标**：实现三视图切换框架、TopBar 交互、Tab 感知。

**前提**：ext-foundation 完成，App.vue + 所有 stores 可用。

**现有代码**：`components/auramind/TopBar.vue`（样式已实现）、`components/auramind/WorkspaceView.vue`（三视图容器已实现）。

**任务**：

1. **完善 App.vue**：按 `appStore.currentView` 使用 `v-show` 切换 WorkspaceView / LibraryView / SettingsView
2. **TopBar 视图切换**：在 `components/auramind/TopBar.vue` 中补充点击事件，调用 `appStore.setView('workspace'|'library'|'settings')`。**只加事件绑定，不改样式。**
3. **副标题动态更新**：根据 `appStore.currentView` 和 `workspaceStore.extractionStatus` 动态显示副标题
4. **Tab 切换感知**：background.ts 广播 `TAB_ACTIVATED` / `TAB_UPDATED`，app.store.ts 接收并更新 `activeTab`、设置 `showPageChangeTip`
5. **页面变化提示条**：Workspace 顶部黄色提示条 "浏览器当前页面已变化，[切换到当前页面]"
6. **Library 选文档跳转 Workspace**：LibraryView 点击文档后切换 `currentView` 为 `workspace`

**验收**：Side Panel 三视图正常切换，TopBar 点击生效，tabs 切换时有提示条。

---

### Phase 3 — web-capture（网页抓取与上下文）

**目标**：实现 content script 网页抓取完整链路（抓取 → defuddle 提取 → 通信回传）。

**前提**：ext-foundation 完成，documentStore 可用。

**参考**：`reference/obsidian-clipper/src/` 中的 content script 架构和 defuddle 调用模式。

**任务**：

1. **content.ts 重写**：注入当前页面，读取 `document.documentElement.outerHTML` → defuddle 提取 → DOMPurify 清洗 → 计算 contentHash/wordCount/tokenCount → fallback 逻辑
2. **SPA 路由监听**：拦截 `history.pushState/replaceState` + `popstate`
3. **通信通道**：background.ts 实现消息路由（`REQUEST_EXTRACT` → content → `EXTRACT_RESULT` / `EXTRACT_ERROR`）
4. **WorkspaceHeader 组件**：`components/workspace/WorkspaceHeader.vue` 展示文档标题、URL 来源域名、token 估算、抓取状态指示灯（idle/extracting/ready/cached/failed/stale 六色圆点）
5. **手动刷新按钮**：点击刷新 → 发 `REQUEST_EXTRACT` → 更新 documentStore → 写 IndexedDB
6. **自动抓取开关**：`CaptureSettings.autoExtractOnOpen` / `autoExtractOnTabChange` 控制自动抓取行为

**验收**：打开 Side Panel 能自动抓取当前页面，显示标题和 token 数，刷新按钮可用。

---

### Phase 4 — context-preview（上下文预览）

**目标**：实现 ContextPanel 的三级 Tab（Markdown 渲染 / Raw 原文 / Metadata 面板）。

**前提**：web-capture 完成，documentStore.currentDocument 有数据。

**现有代码**：`components/auramind/ContextView.vue`（UI 已实现，含二级 Tab 切换布局和复制按钮）。

**任务**：

1. **MarkdownPreview 组件**：`components/workspace/MarkdownPreview.vue`，将 markdown 转为 HTML，DOMPurify 清洗，`v-html` 渲染，highlight.js 代码高亮
2. **RawPreview 组件**：`components/workspace/RawPreview.vue`，等宽字体深色背景显示原文
3. **MetadataPanel 组件**：`components/workspace/MetadataPanel.vue`，只读表单展示全部元数据字段
4. **绑定 ContextView 逻辑**：在 `components/auramind/ContextView.vue` 中接入真实数据（替换 mock 内容），Tab 切换渲染对应子组件。**不改样式，只替换数据绑定和子组件挂载。**
5. **复制 Markdown 按钮**：ContextView 已有复制按钮 UI，接入 `navigator.clipboard.writeText`
6. **rawHtml 可选保存**：根据 `CaptureSettings.saveRawHtml` 控制

**验收**：三 Tab 切换正常，Markdown 渲染含标题/列表/引用/代码高亮，复制按钮可用。

---

### Phase 5 — model-config（模型配置）

**目标**：模型池 CRUD 管理、模型测试连接、systemPrompt 配置。

**前提**：ext-foundation 完成，modelStore 可用，UI 封装组件就绪。

**现有代码**：`components/auramind/ModelCard.vue`（卡片样式已实现）、`components/auramind/ModelModal.vue`（弹窗表单样式已实现）、`components/auramind/SettingsView.vue`（设置页布局已实现）。

**任务**：

1. **ModelCard 逻辑接入**：绑定真实 modelStore 数据，Switch 切换 `toggleEnabled`，删除调用 `deleteModel`。**不改样式。**
2. **ModelModal 表单逻辑**：接入表单校验（name 非空 / modelId 非空 / baseUrl 合法 / temperature 0-2 / contextWindow > 0），自动处理默认模型唯一性。**不改样式。**
3. **编辑模型**：复用 ModelModal，预填数据
4. **删除模型校验**：默认模型禁止删除，弹出提示
5. **测试连接**：三种 Provider（OpenAI Compatible / Anthropic / Ollama）的连通性测试，显示 latency 和状态指示灯
6. **systemPrompt 配置**：每模型 + 全局双级 systemPrompt
7. **修复 AIView.vue**：将 `components/views/AIView.vue` 中直接 `import { SelectRoot, ... } from 'reka-ui'` 替换为 `components/ui/Select.vue` 封装组件。**不改样式。**
8. **SettingsView 逻辑接入**：在 `components/auramind/SettingsView.vue` 中接入真实 modelStore 数据，替换 mock 内容。**不改样式。**

**验收**：模型增删改查正常，测试连接返回状态和延迟，切换默认模型生效。

---

### Phase 6 — ai-provider（AI Provider 适配层）

**目标**：实现三类 Provider 的 chat/streamChat/testConnection + Prompt Builder。

**前提**：model-config 完成，ModelConfig 类型定义就绪。

**任务**：

1. **类型定义**：`services/ai/types.ts` 定义 `AIProvider` interface、`ChatInput`、`ChatOutput`、`StreamCallbacks`
2. **OpenAICompatibleProvider**：`services/ai/openai-compatible.ts`，POST `{baseUrl}/chat/completions`，stream 模式用 eventsource-parser
3. **AnthropicProvider**：`services/ai/anthropic.ts`，Messages API + `x-api-key` header + `anthropic-version`
4. **OllamaProvider**：`services/ai/ollama.ts`，`/api/chat` endpoint + NDJSON stream
5. **Prompt Builder**：`services/prompt/builder.ts` 组装 systemPrompt + page_context + history + userInput
6. **systemPrompt 解析**：`model.systemPrompt || settings.globalSystemPrompt || undefined`
7. **page_context 格式生成**：`services/prompt/context.ts`，按开关控制元数据包含
8. **上下文截断**：`services/prompt/truncate.ts`，取 `model.contextWindow` 和 `settings.context.maxContextTokens` 较小值裁剪
9. **Provider 工厂**：`services/ai/factory.ts`

**验收**：Factory 正确返回 Provider 实例，Prompt Builder 组装结果包含 system prompt + context + history。

---

### Phase 7 — ai-chat（AI 对话与流式输出）

**目标**：完整聊天交互——发送消息 → 流式输出 → 停止/重新生成 → 对话保存。

**前提**：ai-provider 完成，chatStore 可用，documentStore 可选。

**现有代码**：`components/auramind/ChatView.vue`（UI 已实现，含消息列表布局和输入区）、`components/auramind/ChatInput.vue`（输入框已实现）。

**任务**：

1. **ChatMessage 组件**：`components/workspace/ChatMessage.vue`，用户/AI 消息气泡样式
2. **ModelSelect 组件**：`components/workspace/ModelSelect.vue`，下拉 enabledModels
3. **上下文挂载状态**：ChatView 顶部显示当前挂载文档标题或 "未挂载上下文"
4. **Enter 发送 / Shift+Enter 换行**：ChatInput 绑定 keydown 事件
5. **发送前校验**：modelStore.currentModel 存在且 enabled / baseUrl+apiKey 满足 / 无进行中请求
6. **流式 SSE**：eventsource-parser 解析，逐字追加到 assistant message
7. **停止生成**：AbortController.abort()，保留已生成内容
8. **重新生成**：覆盖当前 assistant message，重新流式
9. **失败处理**：红色错误卡片含错误原因
10. **对话保存**：每次消息完成后通过 ConversationRepository 写 IndexedDB
11. **上下文注入**：调用 PromptBuilder.build() 组装完整 prompt
12. **ChatView 逻辑接入**：在 `components/auramind/ChatView.vue` 和 `ChatInput.vue` 中接入真实 chatStore，替换 mock 数据。**不改样式。**

**验收**：发送消息 → 流式逐字输出 → 停止保留 → 对话持久化到 IndexedDB。

---

### Phase 8 — library-search（记忆库与搜索）

**目标**：文档列表 + MiniSearch 全文搜索 + 热力图。

**前提**：ext-foundation 完成，DocumentRepository 可用。

**现有代码**：`components/auramind/LibraryView.vue`（列表布局已实现）、`components/auramind/Heatmap.vue`（热力图已实现）。

**任务**：

1. **MiniSearch 索引初始化**：`services/search/index.ts`，字段 `title/url/siteName/markdown/excerpt`，boost `title:3 siteName:2 markdown:1`
2. **SearchBar 实时搜索**：`components/library/SearchBar.vue`，防抖 300ms 调用 miniSearch.search
3. **空关键词展示最近**：按 capturedAt 降序展示最近 20 条
4. **DocumentItem 组件**：`components/library/DocumentItem.vue`，展示 title/favicon+域名/时间/excerpt
5. **文档点击跳转 Workspace**：loadDocument → currentView 切换
6. **打开原网页**：`browser.tabs.create`
7. **删除文档**：ConfirmDialog → DocumentRepository.delete + 关联对话删除 + miniSearch.remove
8. **索引同步**：新增时 add，更新时 replace，删除时 remove
9. **LibraryView 逻辑接入**：在 `components/auramind/LibraryView.vue` 中接入真实 documentStore 数据，替换 mock。**不改样式。**
10. **Heatmap 逻辑接入**：在 `components/auramind/Heatmap.vue` 中基于真实 capturedAt 数据渲染。**不改样式。**

**验收**：搜索返回匹配文档，点击跳转 Workspace，删除生效，热力图基于真实数据。

---

### Phase 9 — settings-management（设置管理）

**目标**：完整设置面板——上下文设置、抓取设置、存储统计、导入导出、清空数据。

**前提**：ext-foundation 完成，settingsStore 可用。

**现有代码**：`components/auramind/SettingsView.vue`（设置页布局已实现）。

**任务**：

1. **ContextSettings 面板**：`components/settings/ContextSettings.vue`，Slider + Toggle 控件绑定 settingsStore
2. **CaptureSettings 面板**：`components/settings/CaptureSettings.vue`，Toggle 控制各抓取开关
3. **全局 systemPrompt**：textarea 绑定 `settingsStore.globalSystemPrompt`
4. **存储统计**：`components/settings/StorageSettings.vue`，展示文档数/对话数/模型数/IndexedDB 占用/索引状态
5. **导出 JSON**：读取全部数据 → 序列化 → Blob 下载，文件名 `auramind-backup-{date}.json`，导出前提示含敏感数据
6. **导入 JSON**：文件选择 → 解析校验 → 确认覆盖 → 事务写入 IndexedDB → 重建索引
7. **重建搜索索引**：removeAll + 遍历 findAll 逐一 add
8. **清空本地数据**：二次确认 → deleteDatabase → 重置所有 Store → 刷新页面
9. **SettingsView 逻辑接入**：在 `components/auramind/SettingsView.vue` 中接入真实 settingsStore + 子面板。**不改样式。**

**验收**：所有设置项可调且持久化，导出导入完整还原，清空数据不可逆生效。

---

### Phase 10 — data-layer（Repository 抽象层补全与优化）

**目标**：将 Phase 1 中内联的 Repository 调用抽象为独立 Repository 层，优化查询方法。

**前提**：所有前置模块完成。

**任务**：

1. **Repository 接口抽象**：`db/repository.ts` 定义 `IRepository<T>` 泛型接口
2. **DocumentRepository 优化**：补充 `findByUrl`、分页查询、按日期范围查询
3. **ConversationRepository 优化**：补充 `findByDocumentId`、按时间排序
4. **ModelRepository 优化**：补充 `lastUsedAt` 更新
5. **SettingsRepository 优化**：补充迁移逻辑（版本升级时的默认值合并）
6. **Store 重构**：将所有 Store 中的直接 DB 操作替换为 Repository 方法调用（不改变外部行为）
7. **事务优化**：批量导入/清空操作使用 Dexie `transaction('rw', ...)` 确保原子性

**验收**：全量测试通过，构建成功，行为与 Phase 9 完全一致。

---

## 5. 测试标准

### 5.1 测试框架

在 ext-foundation 阶段安装：

```bash
pnpm add -D vitest @vue/test-utils jsdom
```

`vitest.config.ts` 配置 `environment: 'jsdom'`。

### 5.2 每模块测试要求

| 模块 | 最少测试 |
|---|---|
| ext-foundation | Stores 单元测试（状态变更、actions）、Repository 增删查改 |
| app-shell | 视图切换逻辑单元测试 |
| web-capture | content script 数据提取函数单元测试 |
| context-preview | Markdown 渲染管道测试 |
| model-config | 表单校验测试、默认模型唯一性测试 |
| ai-provider | Prompt Builder 输出结构测试、上下文截断测试 |
| ai-chat | 消息流状态机测试、校验逻辑测试 |
| library-search | MiniSearch 索引增删测试 |
| settings-management | 导入 JSON 校验测试、数据清空测试 |
| data-layer | Repository 接口契约测试 |

### 5.3 验收通过标准

```bash
pnpm vue-tsc --noEmit   # 零类型错误
pnpm vitest run          # 全部测试通过
pnpm build               # 构建成功，产出 chrome-mv3 扩展
```

---

## 6. 命令速查

```bash
cd /Users/another/Documents/OpenSource/ai-reader
pnpm install
pnpm dev              # 开发模式
pnpm build            # 生产构建
pnpm vue-tsc --noEmit # 类型检查
pnpm vitest run       # 运行测试
```

每次执行 shell 命令前需加环境前缀：
```bash
export PATH="/usr/local/bin:$PATH:/Users/another/.npm-global/bin"
```

---

## 7. 主 Agent 执行流程

```
1. 读取 doc/prompt.md（本文档）理解全貌
2. 检查环境：pnpm install + 确认 wxt.config.ts / uno.config.ts / package.json
3. 安装测试依赖：pnpm add -D vitest @vue/test-utils jsdom + 创建 vitest.config.ts
4. 读取 doc/tasks/progress.md 了解当前进度
5. FOR EACH module IN [ext-foundation, app-shell, web-capture, context-preview, model-config, ai-provider, ai-chat, library-search, settings-management, data-layer]:
   a. 派发 file-agent 子 Agent：
      - overall_goal: "实现 AuraMind 浏览器扩展，项目根目录 /Users/another/Documents/OpenSource/ai-reader..."
      - current_task: 包含本模块的目标、需读取的文档路径、参考代码路径、任务清单、技术约束
   b. 等待子 Agent 完成
   c. 验证：pnpm vitest run + pnpm vue-tsc --noEmit
   d. 通过 → 更新 progress.md → 下一模块
   e. 失败 → 分析原因 → 重试（最多 2 次）→ 仍失败则终止并报告
6. 全量最终验证：pnpm vue-tsc --noEmit && pnpm vitest run && pnpm build
7. 更新 progress.md 全部模块为 ✅
```
*（内容由AI生成，仅供参考）*
