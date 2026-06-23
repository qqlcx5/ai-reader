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

- [x] **M8 存储与数据层**（`doc/tasks/storage-data.md`）
  - Dexie 数据库初始化、5 张表 Schema、主副表 Repository、三级缓存（L1 LRU / L2 TTL / L3 Hash）、Pinia Store、API Key 存储

- [x] **M2 智能正文提取**（`doc/tasks/context-extraction.md`）
  - 三级降级算法（Readability → Defuddle → innerText）、No Truncation、结构化元数据提取、上下文静默锚定、高亮选区、浮动工具栏（Shadow DOM）、右键菜单、框选模式
  - 30 个单元测试全部通过

- [x] **M3 多模型 Provider 客户端**（`doc/tasks/provider-client.md`）
  - IEngine 抽象接口、15 个 Provider 适配器（11 个 OpenAI-compatible + Anthropic + Gemini + Cohere + ChatGPT Web）、SSE 流式解析（eventsource-parser）、断线重连（指数退避）、故障转移链、错误码分层处理、API Key 安全存储

- [x] **M1 入口与布局**（`doc/tasks/entry-layout.md`）
  - 设计令牌（CSS 变量 / obsidian 色板）、Popup 弹窗（330px）、Side Panel 三区布局、上下文锚定栏、全局提取状态条、桌面端三栏响应式布局、左栏品牌导航、右栏 6 标签面板、Options 设置页、全局快捷键（Alt+S / Alt+P / Escape）、共享组件（Toast / Modal / IconButton）

- [x] **M4 页面对话工作区**（`doc/tasks/chat-workspace.md`）
  - URL 绑定（SHA-256）与会话隔离、Context 自动注入、Arena 多模型并发调度、消息流视图（UserBubble / ModelCard / StreamingText）、模型卡片底栏（TTFT / TPS / Cost）、对话管理（重试 / 编辑 / 删除 / 单分支追问）、底部输入区（ModelRouteChips / QuickPromptBar）、页面摘要卡片

- [x] **M5 AI 工作流**（`doc/tasks/advanced-workflows.md`）
  - 串行接力引擎（Relay Chain，变量传递）、多角色圆桌（Roundtable，3 预设角色）、变量解析器（编译期静态分析，无 eval）、提示词模板系统（CRUD + URL 触发规则 + lz-string 同步）、Filter 管道（40+ 后处理器）、工作流 UI 面板

- [x] **M6 历史库与检索**（`doc/tasks/library.md`）
  - 历史记录列表（vue-virtual-scroller 虚拟滚动）、快照查看器（主副表懒加载 + 双 Tab）、Web Worker 全文检索（search.worker.ts）、搜索结果高亮、历史记录管理（删除 / 批量 / 域名筛选）

- [x] **M7 跨端导出与同步**（`doc/tasks/export-sync.md`）
  - ZIP 全量导出（jszip Web Worker + 进度条）、全量导入合并（覆盖 / 跳过两种策略）、WebDAV 双向增量同步（webdav 库 + chrome.alarms）、Obsidian URI 直写（YAML Frontmatter）、本地文件导出（.md / .html / .txt）、浏览器间设置同步（lz-string 分片）

- [x] **M9 RSS 自动化流水线**（`doc/tasks/rss-pipeline.md`）
  - RSS Fetcher（RSS 2.0 / Atom 1.0）、哈希去重（SHA-256）、AI 后台摘要（静默串行）、Service Worker Alarm 定时调度、扩展 Badge 未读计数、RSS 面板 UI（FeedList / ArticleItem / AddFeedModal）、今日简报（Daily Briefing + 导出到 Obsidian）、Options RSS 管理

---

## 里程碑

- [x] **MVP 可运行**（v0.5）
  - M8 + M2 + M3 + M1 + M4 完成 ✅
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

---

## 代码审查记录（2026-06-23）

> 审查范围：M8 / M2 / M3 / M1 / M4 / M5 / M6，全量源文件阅读 + TypeScript 编译验证。

### 发现问题（共 9 项）

| # | 级别 | 模块 | 文件 | 描述 |
|---|------|------|------|------|
| 1 | 🔴 Critical | M1/M3 | `types/chrome.d.ts` | 缺少 `contextMenus`、`runtime`、`tabs`、`sidePanel`、`alarms` 命名空间，导致 `background.ts` 多处编译错误 |
| 2 | 🔴 Critical | M4 | `stores/conversation.store.ts:51` | `loadOrCreate` 第二参数 `title` / `domain` 标为必填，导致 `loadOrCreateByUrl` 调用处 TS2345 类型错误 |
| 3 | 🔴 Critical | 安全 | `modules/storage/types.ts:265-268` | `defaultSettings` 硬编码明文 API Key + 服务器地址，且两个 Provider 共用同一 ID `'custom-default'` |
| 4 | 🔴 Critical | M1/M4 | `components/layout/RightPanelTabs.vue:206-223` | 架构 tab 使用了独立 `<script>` 块导出 `renderArch`，该函数在模板中不可见（Vue 3 `<script setup>` 隔离），运行时 `renderArch is not defined` |
| 5 | 🟡 Warning | M4 | `components/chat/UserBubble.vue:130` | 气泡圆角 `16px 16px 4px 16px`（右下角小圆），设计要求 `rounded-2xl rounded-tr-sm` = `16px 6px 16px 16px`（右上角小圆） |
| 6 | 🟡 Warning | M1 | `components/layout/ContextStatusBar.vue:222` | favicon 容器 36×36px，设计要求 40×40px |
| 7 | 🟡 Warning | M8 | `modules/storage/types.ts` | `ProviderConfig.type` 字段限制为 `'openai'\|'anthropic'\|'gemini'\|'custom'`，无法覆盖 M3 中全部 15 个 Provider |
| 8 | 🟢 Minor | M2 | `lib/extraction/types.ts` 与 `lib/db/types.ts` | 存在两套不同 `ExtractionResult` / `PageMetadata` 定义（提取层 vs 存储层），字段不一致需桥接层（`markdown` vs `markdownText` 等） |
| 9 | 🟢 Minor | M4 | `components/chat/StreamingText.vue:25-31` | `displayHtml` computed 永远返回 `''`，为未完成的 stub 代码，无功能影响但冗余 |

### 已修复（共 6 项）

1. **`types/chrome.d.ts`** — 补全 `contextMenus` / `runtime` / `tabs` / `sidePanel` / `alarms` 全部命名空间，`sendMessage` 返回类型改为 `Promise<unknown>` 以支持 `.catch()`
2. **`types/vue-shims.d.ts`** — 新建 Vue SFC 模块声明，解决 `entrypoints/*/main.ts` 无法找到 `./App.vue` 的问题
3. **`stores/conversation.store.ts:43-52`** — `loadOrCreate` 第二参数 `title`/`domain` 改为可选，移除复杂的条件类型表达式
4. **`modules/storage/types.ts`** — 删除 `defaultSettings` 中的硬编码明文 API Key 和重复 Provider ID，`providers` 初始化为空数组
5. **`components/chat/UserBubble.vue:130`** — 气泡圆角修正为 `16px 6px 16px 16px`（右上角对齐设计稿 `rounded-tr-sm`）
6. **`components/layout/ContextStatusBar.vue:222`** — favicon 容器尺寸从 36px 修正为 40px
7. **`components/layout/RightPanelTabs.vue`** — 将 `renderArch` 函数移入 `<script setup>` 块，删除多余的独立 `<script>` 块

### TypeScript 编译结果

```
修复前：9 个编译错误（background.ts + main.ts × 3 + conversation.store.ts）
修复后：0 个编译错误 ✅
```

### 通过验证的架构红线

- ✅ M8 三级缓存：L1 LRU 容量 20、L2 TTL 24h、L3 SHA-256 Key
- ✅ M8 主副表读写分离：`message.repo.ts` 无批量扫描接口（`bulkPut` 仅用于导入恢复，非查询接口）
- ✅ M2 Defuddle 8s 超时：`Promise.race` + `setTimeout` 正确实现
- ✅ M2 无截断：`ExtractionResult.markdown` / `rawText` 无任何 `slice`/`substring`
- ✅ M3 15 个 Provider 全部注册到 registry（OpenAI/Anthropic/Gemini/DeepSeek/Groq/Cerebras/Perplexity/xAI/Moonshot/MiniMax/Cohere/Azure/LMStudio/Ollama/ChatGPTWeb）
- ✅ M3 指数退避重连：1s→2s→4s→8s→16s→max 30s，最多 5 次
- ✅ M3 API Key 只存 `chrome.storage.local`，不写 IndexedDB
- ✅ M5 variable-resolver 无 `eval()`/`Function()`
- ✅ M5 filters.ts 共 46 个 Filter 函数（超过 40+ 要求）
- ✅ M6 HistoryList 使用 `RecycleScroller` 虚拟滚动
- ✅ M6 search.worker snippet 前后各 60 字符
- ✅ M4 StreamingText rAF 16ms 节流（`requestAnimationFrame` fallback `setTimeout 16ms`）
- ✅ CSS 变量完整（16 个 obsidian 色彩变量 + `--toast-bg: #2d2c29` 等）
- ✅ Toast：`#2d2c29` 背景、`rounded-full`、左侧 pulsing 色点
- ✅ Modal：遮罩 `rgba(0,0,0,0.35) backdrop-blur(4px)`、`rounded-2xl`、标题栏 `card` 背景
- ✅ `.typing-cursor::after { content: '▋'; animation }` 已实现（theme.css + StreamingText scoped）
- ✅ ModelCardFooter：`font-mono text-[10px]`、`⚡ Cached` 使用 `var(--green)` 颜色
- ✅ RightPanelTabs：6 个标签，激活态 `border-bottom-color: var(--primary)` + `color: var(--primary)`
