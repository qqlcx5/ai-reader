# AI Reader 总体开发进度

> **输入**：`doc/1.md`（需求文档）、`doc/design-*.md`（详细设计）
> **任务清单**：`doc/tasks/module-name.md`
> **更新方式**：每个模块所有子任务完成后，勾选本文件对应模块；可直接用此文件做 Vibe Coding 看板。

---

## 执行建议顺序

| 阶段 | 模块 | 原因 |
|------|------|------|
| 第一阶段 | M7 存储与数据层 | 所有业务模块依赖 |
| 第一阶段 | M2 上下文提取 | 可独立开发，无 UI 依赖 |
| 第一阶段 | M3 Provider 与 LLM 客户端 | 可被独立单元测试 |
| 第二阶段 | M1 入口与布局 | 需要 M7 提供状态；M4 完成后可替换中部内容 |
| 第二阶段 | M4 多模型工作区 | 依赖 M2、M3、M7 |
| 第三阶段 | M5 高阶 AI 工作流 | 依赖 M3、M4 |
| 第三阶段 | M6 跨端输出与灾备同步 | 依赖 M7，可并行 |
| 第三阶段 | M8 后台 RSS 流水线 | 依赖 M3、M7，可并行 |

---

## 模块完成 Checklist

- [x] **M7 存储与数据层**（`doc/tasks/storage-data.md`）
  - Dexie 数据库、主副表、Pinia 同步、虚拟滚动、Worker 检索、分片缓存、明文 API Key 存储
  - **状态：核心代码已完成，待性能测试验证**

- [x] **M2 上下文提取**（`doc/tasks/context-extraction.md`）
  - Readability / Defuddle / innerText 三级降级、分片传输、上下文锚定
  - **状态：核心代码已完成，单元测试通过，待集成测试验证**

- [x] **M3 Provider 与 LLM 客户端**（`doc/tasks/provider-client.md`）
  - OpenAI / Anthropic / Gemini / Custom Provider、自定义 base URL 与模型、SSE 流式、明文 API Key、错误重试
  - **状态：核心代码完成，50 单元测试通过（src + extraction spec），TypeScript 编译通过**

- [x] **M1 入口与布局**（`doc/tasks/entry-layout.md`）
  - Popup / Side Panel / Options 三入口、设计令牌、ThemeProvider、ContextStatusBar、ActionBar、ContextSummary、共享组件（IconButton/LoadingDots/EmptyState/NavTabs）、3 个 commands（Alt+S / Alt+P / Esc）、ABORT_ALL 广播
  - **状态：核心代码完成，81 单元测试全过，TypeScript 编译通过，wxt build 成功生成 .output/chrome-mv3/**

- [x] **M4 多模型工作区**（`doc/tasks/chat-workspace.md`）
  - 多模型并发（runMultiModelChat）、增量流式渲染（StreamingText + markdown-it）、指标底栏（ModelCardFooter）、分支追问、System Prompt 上下文注入
  - 核心实现位于 `lib/workspace/`（types / buildSystemPrompt / scheduler），UI 位于 `components/workspace/`
  - 重要架构调整：代码从 `modules/workspace/` 迁移到 `lib/workspace/`，因 WXT 0.20 会自动扫描 `modules/*/index.ts` 作为用户模块，该目录下的 jiti 加载无法解析 tsconfig path 别名 `@/...`，必须移出 `modules/`
  - **状态：92 单元测试全过（11 新增），TypeScript 编译通过，wxt build 成功（sidepanel 254KB / total 730KB）**

- [x] **M5 高阶 AI 工作流**（`doc/tasks/advanced-workflows.md`）
  - Roundtable 圆桌、Relay Chain 接力链、模板管理、上下文注入、并发/串行执行
  - 核心实现位于 `lib/workflow/`（topological-sort / runner / roundtable / relay / templates / types / index）
  - 存储层新增 `workflow-template.repo.ts`（`modules/storage/repositories/`，CRUD + 内置模板 seed）
  - Pinia store `workflow.store.ts` 管理 active session 与 per-node 状态
  - UI 组件：`WorkflowTemplateList`、`NodeEditor`、`WorkflowTemplateEditor`、`WorkflowResults`
  - 业务逻辑：单节点错误不中断 Roundtable；Relay 任一节点失败立即中断后续；上游输出拼接到下游 user message；context 通过 system prompt（Roundtable）或 user message（Relay）注入
  - 决策：保留 `modules/workflow/` 存根（防止 WXT 0.20 自动扫描），实现在 `lib/workflow/`
  - **状态：123 单元测试全过（含 28 新增：topological-sort 9、roundtable 6、relay 6、templates 7），TypeScript 编译通过，wxt build 成功（total 730KB）**

- [x] **M6 跨端输出与灾备同步**（`doc/tasks/export-sync.md`）
  - Obsidian URI 直写、WebDAV 同步、Zip 手动导出、自动备份调度
  - 核心实现位于 `lib/export/`（obsidian / webdav / zip / zip.worker / scheduler / backup / markdown / options / view-models）
  - Options Sync Tab 表单（SyncOptionsPanel.vue）、background.ts auto-backup alarm handler
  - 类型修复：引入 view-models.ts 桥接 M7 ConversationRecord/MessageRecord 与导出视图模型
  - **状态：52 单元测试全过，TypeScript 编译通过，wxt build 成功（total 1.15MB）**

- [x] **M8 后台 RSS 流水线**（`doc/tasks/rss-pipeline.md`）
  - 定时抓取、哈希去重、AI 摘要、badge 更新
  - 核心实现位于 `lib/rss/`（types / fetcher / dedup / scheduler / summarizer / badge / pipeline）
  - **状态：核心代码完成，23 单元测试通过，TypeScript 编译通过，wxt build 成功（total 1.15MB）**
  - RSS UI（Tab、FeedList、ItemList）与 Options RSS 管理 UI 留待二期

---

## 里程碑

- [x] **MVP 可运行**：M7 + M2 + M3 + M1 + M4 完成，可打开 Side Panel、提取页面、并发对话。
  - **当前：M7 / M2 / M3 / M1 / M4 已完成，可进入 MVP 验证。**
- [x] **工作流版**：MVP + M5 完成，可运行 Roundtable 与 Relay Chain。
- [x] **完整版**：全部模块完成，包含导出、同步、RSS。

---

## 当前状态

- 8 份详细设计文档已生成（`doc/design-01-entry-layout.md` ~ `design-08-rss-pipeline.md`）。
- 8 份模块任务清单已生成（`doc/tasks/entry-layout.md` ~ `rss-pipeline.md`）。
- 第一阶段 + 第二阶段 + 第三阶段全部完成：M7 / M2 / M3 / M1 / M4 / M5 / M6 / M8 八模块完成，**完整版** 达成。
- 二期待做：RSS 信息流 UI（Side Panel Tab）、S3 兼容上传、真实 WebDAV/Obsidian 集成测试。
- 架构调整记录：M4 代码从 modules/workspace/ 迁移到 lib/workspace/，原因 WXT 0.20 自动扫描 modules/*/index.ts，但 jiti 不支持 tsconfig path 别名；M5 遵循同一约束；M6 遵循同一约束（lib/export/）。
- M6 类型修复记录：原 M6 代码引用了不存在的 Conversation/Message 类型和不存在的 settingsStore 导出。引入 view-models.ts 将 ConversationRecord/MessageRecord 映射为导出用 Conversation/Message 视图模型；将 settingsStore 修正为 useSettingsStore；scheduler 使用 browser 全局替代 chrome.alarms 类型。
