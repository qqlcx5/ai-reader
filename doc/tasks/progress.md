# AuraMind 研发进度

> 更新日期：2026-06-28

## 模块进度总览

| 模块 | 状态 | 完成日期 | 备注 |
|---|---|---|---|
| ext-foundation | ✅ | 2026-06-27 | WXT 工程 + Chrome Manifest + 基础组件库 + 数据库 |
| app-shell | ✅ | 2026-06-28 | TopBar + 三视图切换 + Tab 感知 + 页面变化提示条 |
| web-capture | ✅ | 2026-06-28 | content.ts(SPA监听+defuddle) + background转发 + capture.service + WorkspaceHeader |
| context-preview | ✅ | 2026-06-28 | Markdown/Raw/Metadata 预览 |
| model-config | ✅ | 2026-06-28 | 模型池 CRUD + 测试连接 + systemPrompt |
| ai-chat | 未开始 | — | 对话 UI + 流式输出 + 对话保存 |
| ai-provider | ✅ | 2026-06-28 | OpenAI/Anthropic/Ollama 适配 + Prompt Builder + Context/Truncate |
| library-search | 未开始 | — | MiniSearch 索引 + 文档列表 + 搜索 |
| settings-management | 未开始 | — | 设置面板 + 存储统计 + 导入导出 |
| data-layer | 未开始 | — | Dexie 表定义 + Repository + Pinia Store |

## model-config 产出清单 (2026-06-28)

| 文件 | 说明 |
|---|---|
| `services/ai/test-connection.service.ts` | 三 provider 路由测试连接（OpenAI Compatible/Anthropic/Ollama），10s 超时 |
| `components/auramind/ModelCard.vue` | store-driven 模型卡片（name/provider/modelId/baseUrl/启用Switch/默认Badge/测试指示灯/编辑删除按钮） |
| `components/auramind/ModelEditorDialog.vue` | 全功能添加/编辑弹窗（11字段表单+校验） |
| `components/auramind/SettingsView.vue` | 替换所有 mock 数据为 modelStore/settingsStore 驱动 |
| `stores/model.store.ts` | testConnection 真实实现（调用 test-connection.service） |
| `stores/model.store.test.ts` | 10 用例（add/edit/delete/setDefault/testConnection） |
| `services/ai/test-connection.service.test.ts` | 5 用例（3 provider路由/失败/网络错误） |
| `components/auramind/ModelCard.test.ts` | 12 用例（渲染/状态指示器/emit） |
| `components/auramind/ModelEditorDialog.test.ts` | 7 用例（标题/表单字段/close/overlay） |

## ai-provider 产出清单 (2026-06-28)

| 文件 | 说明 |
|---|---|
| `services/ai/shared.ts` | 共享工具函数（normalizeBaseUrl/fetchWithTimeout/anySignal） |
| `services/ai/openai-compatible.ts` | 重构：删除内联辅助函数，改为从 shared 导入 |
| `services/ai/anthropic.ts` | AnthropicProvider — Messages API + x-api-key + SSE content_block_delta |
| `services/ai/ollama.ts` | OllamaProvider — /api/chat + NDJSON 流式 + /api/tags 连通测试 |
| `services/ai/factory.ts` | createProvider 工厂 — 三 provider 单例路由 |
| `services/prompt/builder.ts` | PromptBuilder.build() — systemPrompt/context/history/userInput 组装 |
| `services/prompt/context.ts` | buildPageContext() — Markdown 格式化页面上下文 |
| `services/prompt/truncate.ts` | truncateContext() — token 估算截断（~4字符/token）|
| `services/ai/anthropic.test.ts` | 10 用例（chat/streamChat/testConnection） |
| `services/ai/ollama.test.ts` | 9 用例（chat/NDJSON流/streamChat/testConnection） |
| `services/prompt/builder.test.ts` | 8 用例（组装顺序/system字段/空值处理） |
| `services/prompt/context.test.ts` | 5 用例（格式化/字段存在性/完整输出） |
| `services/prompt/truncate.test.ts` | 7 用例（保留原文/尾部截断/段落边界/边界值） |
| `services/ai/factory.test.ts` | 7 用例（三provider路由/单例/交叉调用单例/异常） |

## 阶段划分

| Phase | 包含模块 | 说明 |
|---|---|---|
| Phase 1 — 插件基础与 UI 框架 | ext-foundation, app-shell | 工程初始化、Side Panel 可运行、三视图切换 |
| Phase 2 — 网页抓取与上下文预览 | web-capture, context-preview | content script 抓取、defuddle 提取、预览面板 |
| Phase 3 — 模型配置与 Prompt Builder | model-config, ai-provider | 模型池管理、Provider 适配层、Prompt 组装 |
| Phase 4 — AI 对话与流式输出 | ai-chat | 聊天 UI、流式 SSE、对话持久化 |
| Phase 5 — 记忆库与搜索 | library-search | MiniSearch 索引、文档搜索与管理 |
| Phase 6 — 存储管理与导入导出 | settings-management, data-layer | 数据导出导入、存储统计、清空数据 |
