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

- [ ] **M2 上下文提取**（`doc/tasks/context-extraction.md`）
  - Readability / Defuddle / innerText 三级降级、分片传输、上下文锚定

- [ ] **M3 Provider 与 LLM 客户端**（`doc/tasks/provider-client.md`）
  - OpenAI / Anthropic / Gemini / Custom Provider、自定义 base URL 与模型、SSE 流式、明文 API Key

- [ ] **M1 入口与布局**（`doc/tasks/entry-layout.md`）
  - Popup、Side Panel、Options、全局快捷键

- [ ] **M4 多模型工作区**（`doc/tasks/chat-workspace.md`）
  - 多模型并发、增量流式渲染、指标底栏、分支追问

- [ ] **M5 高阶 AI 工作流**（`doc/tasks/advanced-workflows.md`）
  - Roundtable 圆桌、Relay Chain 接力链、模板管理

- [ ] **M6 跨端输出与灾备同步**（`doc/tasks/export-sync.md`）
  - Obsidian URI、WebDAV、Zip 导出、自动备份

- [ ] **M8 后台 RSS 流水线**（`doc/tasks/rss-pipeline.md`）
  - 定时抓取、哈希去重、AI 摘要、badge 更新

---

## 里程碑

- [ ] **MVP 可运行**：M7 + M2 + M3 + M1 + M4 完成，可打开 Side Panel、提取页面、并发对话。
- [ ] **工作流版**：MVP + M5 完成，可运行 Roundtable 与 Relay Chain。
- [ ] **完整版**：全部模块完成，包含导出、同步、RSS。

---

## 当前状态

- 8 份详细设计文档已生成（`doc/design-01-entry-layout.md` ~ `design-08-rss-pipeline.md`）。
- 8 份模块任务清单已生成（`doc/tasks/entry-layout.md` ~ `rss-pipeline.md`）。
- 等待开始第一阶段开发。
