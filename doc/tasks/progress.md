# ReadChat Clipper — 总体开发进度 (v1)

> **需求文档**：`doc/proposal_v1.md`（v1.1 详细设计稿）
> **视觉规范**：`doc/design.html` / `doc/design-tokens.md`
> **任务清单**：每个模块对应一个 `doc/tasks/module-name.md`
> **更新方式**：每个模块所有子任务完成后勾选本文件对应项；可直接用此文件做 Vibe Coding 看板。

---

## 推荐执行顺序

| 阶段 | 模块 | 原因 |
|------|------|------|
| 第一阶段 | **M8 存储与数据层** | 所有业务模块的数据基础，必须最先完成 |
| 第一阶段 | **M2 智能正文提取** | 无 UI 依赖，可独立开发与单元测试 |
| 第一阶段 | **M3 多模型 Provider 客户端** | 无 UI 依赖，可独立单元测试 |
| 第二阶段 | **M1 入口与布局** | 需要 M8 提供状态；M4 完成后替换中部内容 |
| 第二阶段 | **M4 页面对话工作区** | 依赖 M2（提取）、M3（Provider）、M8（存储）|
| 第三阶段 | **M5 AI 工作流** | 依赖 M3、M4 调度器与数据模型 |
| 第三阶段 | **M6 历史库与检索** | 依赖 M8 主副表读写 |
| 第三阶段 | **M7 跨端导出与同步** | 依赖 M8，可与 M5/M6 并行 |
| 第三阶段 | **M9 RSS 流水线** | 依赖 M3、M8，可与 M5/M6 并行 |

---

## 模块完成 Checklist

- [ ] **M8 存储与数据层**（`doc/tasks/storage-data.md`）
  - Dexie 数据库初始化、5 张表 Schema、主副表 Repository、三级缓存（L1 LRU / L2 TTL / L3 Hash）、Pinia Store、API Key 存储
  
- [ ] **M2 智能正文提取**（`doc/tasks/context-extraction.md`）
  - 三级降级算法（Readability → Defuddle → innerText）、No Truncation、结构化元数据提取、上下文静默锚定、高亮选区、浮动工具栏（Shadow DOM）、右键菜单、框选模式

- [ ] **M3 多模型 Provider 客户端**（`doc/tasks/provider-client.md`）
  - IEngine 抽象接口、15 个 Provider 适配器（11 个 OpenAI-compatible + Anthropic + Gemini + Cohere + ChatGPT Web）、SSE 流式解析（eventsource-parser）、断线重连（指数退避）、故障转移链、错误码分层处理、API Key 安全存储

- [ ] **M1 入口与布局**（`doc/tasks/entry-layout.md`）
  - 设计令牌（CSS 变量 / obsidian 色板）、Popup 弹窗（330px）、Side Panel 三区布局、上下文锚定栏、全局提取状态条、桌面端三栏响应式布局、左栏品牌导航、右栏 6 标签面板、Options 设置页、全局快捷键（Alt+S / Alt+P / Escape）、共享组件（Toast / Modal / IconButton）

- [ ] **M4 页面对话工作区**（`doc/tasks/chat-workspace.md`）
  - URL 绑定（SHA-256）与会话隔离、Context 自动注入、Arena 多模型并发调度、消息流视图（UserBubble / ModelCard / StreamingText）、模型卡片底栏（TTFT / TPS / Cost）、对话管理（重试 / 编辑 / 删除 / 单分支追问）、底部输入区（ModelRouteChips / QuickPromptBar）、页面摘要卡片

- [ ] **M5 AI 工作流**（`doc/tasks/advanced-workflows.md`）
  - 串行接力引擎（Relay Chain，变量传递）、多角色圆桌（Roundtable，3 预设角色）、变量解析器（编译期静态分析，无 eval）、提示词模板系统（CRUD + URL 触发规则 + lz-string 同步）、Filter 管道（40+ 后处理器）、工作流 UI 面板

- [ ] **M6 历史库与检索**（`doc/tasks/library.md`）
  - 历史记录列表（vue-virtual-scroller 虚拟滚动）、快照查看器（主副表懒加载 + 双 Tab）、Web Worker 全文检索（search.worker.ts）、搜索结果高亮、历史记录管理（删除 / 批量 / 域名筛选）

- [ ] **M7 跨端导出与同步**（`doc/tasks/export-sync.md`）
  - ZIP 全量导出（jszip Web Worker + 进度条）、全量导入合并（覆盖 / 跳过两种策略）、WebDAV 双向增量同步（webdav 库 + chrome.alarms）、Obsidian URI 直写（YAML Frontmatter）、本地文件导出（.md / .html / .txt）、浏览器间设置同步（lz-string 分片）

- [ ] **M9 RSS 自动化流水线**（`doc/tasks/rss-pipeline.md`）
  - RSS Fetcher（RSS 2.0 / Atom 1.0）、哈希去重（SHA-256）、AI 后台摘要（静默串行）、Service Worker Alarm 定时调度、扩展 Badge 未读计数、RSS 面板 UI（FeedList / ArticleItem / AddFeedModal）、今日简报（Daily Briefing + 导出到 Obsidian）、Options RSS 管理

---

## 里程碑

- [ ] **MVP 可运行**（v0.5）
  - M8 + M2 + M3 + M1 + M4 完成
  - 可打开 Side Panel，提取页面正文，与单模型对话，历史记录持久化

- [ ] **核心差异化版**（v0.8）
  - MVP + M4 Arena Mode 完善 + M3 全部 Provider
  - 多模型并发对比可用，TTFT/TPS/Cost 指标正常展示

- [ ] **工作流版**（v1.0）
  - v0.8 + M5 + M6
  - 可运行 Roundtable 与 Relay Chain，历史库检索可用

- [ ] **完整版**（v1.2）
  - 全部 9 个模块完成，包含导出、同步、RSS 今日简报

---

## 架构红线（所有模块必须遵守）

1. **列表渲染**：历史列表必须使用 `vue-virtual-scroller`，严禁 `v-for` 全量渲染
2. **数据库读写分离**：严禁在列表页查询副表 `Messages`，仅在用户点击时懒加载
3. **Web Worker 检索**：搜索逻辑放入 `search.worker.ts`，严禁主线程正则全文扫描
4. **流式渲染节流**：使用 `requestAnimationFrame` 约 16ms 节流，帧率目标 ≥ 45fps
5. **AbortController 隔离**：每个 Provider SSE 连接绑定独立 `AbortController`
6. **Shadow DOM 注入**：浮动工具栏、右键注入 UI 全部使用 Shadow DOM 隔离
7. **模板安全**：变量解析走编译期静态分析，严禁 `eval()` / `Function()` 动态执行
8. **API Key 不过服务器**：所有 LLM 请求直连厂商端点，Key 仅存 `chrome.storage.local`

---

## 当前状态

- 9 份模块任务清单已生成（`doc/tasks/*.md`）
- 需求文档版本：`proposal_v1.md` v1.1 详细设计稿
- 视觉稿：`doc/design.html`（含完整 Vue 3 交互原型）+ `doc/design-tokens.md`（设计令牌速查）
- 所有模块待开发，建议从 **M8 存储与数据层** 开始
