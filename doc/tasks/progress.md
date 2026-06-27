# AuraMind 研发进度

> 更新日期：2026-06-27

## 模块进度总览

| 模块 | 状态 | 完成日期 | 备注 |
|---|---|---|---|
| ext-foundation | 未开始 | — | WXT 工程 + Chrome Manifest + 基础组件库 + 数据库 |
| app-shell | 未开始 | — | TopBar + 三视图切换 + Tab 感知 |
| web-capture | 未开始 | — | content script + defuddle 抓取 + 通信通道 |
| context-preview | 未开始 | — | Markdown/Raw/Metadata 预览 |
| ai-chat | 未开始 | — | 对话 UI + 流式输出 + 对话保存 |
| model-config | 未开始 | — | 模型池 CRUD + 测试连接 + systemPrompt |
| ai-provider | 未开始 | — | OpenAI/Anthropic/Ollama 适配 + Prompt Builder |
| library-search | 未开始 | — | MiniSearch 索引 + 文档列表 + 搜索 |
| settings-management | 未开始 | — | 设置面板 + 存储统计 + 导入导出 |
| data-layer | 未开始 | — | Dexie 表定义 + Repository + Pinia Store |

## 阶段划分

| Phase | 包含模块 | 说明 |
|---|---|---|
| Phase 1 — 插件基础与 UI 框架 | ext-foundation, app-shell | 工程初始化、Side Panel 可运行、三视图切换 |
| Phase 2 — 网页抓取与上下文预览 | web-capture, context-preview | content script 抓取、defuddle 提取、预览面板 |
| Phase 3 — 模型配置与 Prompt Builder | model-config, ai-provider | 模型池管理、Provider 适配层、Prompt 组装 |
| Phase 4 — AI 对话与流式输出 | ai-chat | 聊天 UI、流式 SSE、对话持久化 |
| Phase 5 — 记忆库与搜索 | library-search | MiniSearch 索引、文档搜索与管理 |
| Phase 6 — 存储管理与导入导出 | settings-management, data-layer | 数据导出导入、存储统计、清空数据 |
