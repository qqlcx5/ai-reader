# 产品需求文档 (PRD)：ReadChat Clipper
> **文档版本**：v1.1 详细设计稿
> **产品定位**：一款主打"一页一会话（Page-Isolated Chat）"的浏览器扩展。
> **视觉规范**：以 `design.html` 为准，`design-tokens.md` 为速查索引。
> **参考原型**：`proposal_v0.md` 提供工程级实现细节与原型验证数据。

---

## 1. 产品概述

### 1.1 产品定位

ReadChat Clipper 是一款运行于浏览器侧边栏的 AI 阅读辅助扩展。它能够精准提取当前网页的正文内容作为背景知识，让用户通过调用大模型（LLM）与当前网页进行深度对话。所有提取的内容和对话记录均与特定网页绑定，持久化保存在本地，并支持跨设备 / 跨浏览器的全量备份与恢复。

### 1.2 核心价值

| 维度 | 描述 |
|:---|:---|
| **专注阅读与思考** | 借鉴 Obsidian Clipper 的提取算法，去广告、去干扰，只保留核心正文 |
| **上下文绝对隔离** | 页面 A 的对话绝不会污染页面 B，符合人类基于特定文章进行批注和探讨的认知习惯 |
| **数据资产私有化** | 对话不再阅后即焚，不仅保留文章快照，还保留基于文章的思想碰撞（对话），并支持完全导出 |
| **零后端依赖** | API Key 安全存储于本地，请求直连各厂商端点，绝不经过第三方服务器 |

### 1.3 竞品对比定位

| 产品 | 优势 | 我们差异化 |
|:---|:---|:---|
| Sider AI | 多模型 + 页面感知 | 页面隔离对话 + 本地资产管理 + 全量备份 |
| ChatGPTBox | 浮动工具栏 + 多站适配 | 正文快照 + 会话持久化 + 多模型并发对比 |
| Page Assist | 本地模型侧边栏 | 支持云端 API + 工作流编排 + RSS 简报 |
| Obsidian Clipper | 网页剪藏 + 元数据 | 加入 AI 对话层 + 多模型 Arena 模式 |

### 1.4 全局快捷键

| 快捷键 | 行为 |
|:---|:---|
| `Alt/Option + S` | 唤起侧边栏，静默提取当前页并执行默认提示词 |
| `Alt/Option + P` | 显隐侧边栏 |
| `Escape` | 一键中断当前所有网络生成请求 |

---

## 2. 核心功能需求

### 2.1 智能正文提取（Readability Engine）

> 设计目标：从任意网页中高保真提取结构化正文，输出干净的 Markdown，为下游 AI 分析提供高质量上下文。

#### 2.1.1 三级降级提取算法

| 优先级 | 引擎 | 触发条件 | 超时限制 | 输出格式 |
|:---:|:---|:---|:---:|:---|
| 1 | `@mozilla/readability` | 默认首选，纯本地 | — | Markdown（经 `turndown` 转换） |
| 2 | `defuddle`（异步远程） | Readability 返回空或置信度低 | 8 秒 | Markdown（内置 `createMarkdownContent`） |
| 3 | `document.body.innerText` 清洗 | 前两步均失败 | — | 纯文本 |

- **第一级**：Mozilla Readability 经长期生产验证，纯本地运算，零网络请求，毫秒级剥离广告与噪音节点。原型验证：本地提取纯正文成功耗时仅 38ms，节点纯化比例 94.6%。
- **第二级**：Defuddle 服务端接口，采用 `extractPageContent` + `initializePageContent` 双阶段提取（先获取基础元数据再异步加载正文），8 秒超时后降级。
- **第三级**：强制清洗 DOM 树中的 `<script>` 与 `<style>` 节点，直取 `document.body.innerText` 作为兜底。

#### 2.1.2 无限制上下文直通（No Truncation）

- **不设硬性字符 / Token 上限**。系统严禁在前端对提取内容做任何截断或丢弃，充分利用 Gemini 1M+、Claude 200k+ 超长上下文能力。
- 原型验证：已成功传递 1,045,200 字（约 1.04M 字符）的超长正文直灌 API。
- 提取状态栏展示 `No Truncation` 绿色 badge，明示当前无截断状态。

#### 2.1.3 结构化元数据提取

提取页面时同步采集以下元数据并作为系统变量注入 Prompt 上下文：

| 类别 | 变量 | 说明 |
|:---|:---|:---|
| 预置 | `title` / `author` / `description` / `published` | 页面基础信息 |
| 预置 | `site` / `domain` / `favicon` / `image` | 站点信息与社交图 |
| 预置 | `words` | 字数统计 |
| Meta | `og:title` / `og:description` / `og:image` | Open Graph 数据 |
| Schema.org | `@Article` / `@Recipe` / `@Product` | JSON-LD / Microdata 结构化数据 |

#### 2.1.4 上下文静默锚定机制

- 侧边栏顶部常驻**当前上下文状态栏**，显示已锚定的页面 favicon、标题与字数。
- 切换浏览器 Tab 时，系统**静默保持**上一次提取的网页作为对话上下文，不打断原有对话流。
- 提供【⟳ 刷新提取当前 Tab】主按钮，供用户主动更新上下文。
- 切换 Tab 时弹出"上下文静默锚定"轻量提示，告知用户对话上下文仍锁定在原页面。

#### 2.1.6 高亮选区提取

借鉴 Obsidian Clipper 的 Highlighter 系统：

- 用户在页面划选文本 / 图片 / 元素后，支持三种内容模式：
  - ① 嵌入高亮标记的完整正文（`==highlight==` 语法）
  - ② 仅提取高亮内容列表
  - ③ 忽略高亮保持原文
- 高亮数据通过 Dexie.js 跨会话持久化，关闭页面后再次打开仍可恢复。
- 高亮数据可按域名分组管理，支持 `.json` 导出。
- 多种标记样式预设：点状下划线、高亮背景色、模糊、波浪线、弱化、边框、斜体、加粗及自定义 CSS。

#### 2.1.7 浮动工具栏与右键菜单

- **浮动工具栏**：页面划选文本后自动弹出，提供解释 / 总结 / 翻译 / 提问四个快捷操作，定位在选区附近并自动避开边缘。
- **右键菜单集成**：通过 `chrome.contextMenus` API 注入 AI 操作项（解释 / 总结 / 翻译 / 朗读 / 搜索），仅在有选区时显示。
- **Shadow DOM 隔离**：浮动工具栏和右键注入 UI 均使用 Shadow DOM 承载，配合 CSS Modules 命名隔离，彻底避免与宿主页面样式冲突。

---

### 2.2 多模型管理与安全配置（Local Provider）

> 设计目标：零后端依赖，API Key 安全存储于本地，请求直连各厂商端点。

#### 2.2.1 安全存储方案

| 存储位置 | 用途 | 特性 |
|:---|:---|:---|
| `chrome.storage.local` | API Key 持久化 | 跨会话保留，仅本地可读 |
| `chrome.storage.session` | 临时会话密钥 | 浏览器关闭即清除 |
| `chrome.storage.sync` | Provider 配置同步 | 跨浏览器同步（经 lz-string 压缩分片） |

- API Key 在前端直接调用各厂商端点（如 `api.openai.com`），**绝不经过第三方服务器**。
- 每个 Provider 支持独立配置自定义 Base URL（代理 URL），全局代理开关可一键路由所有请求。

#### 2.2.2 支持的 Provider 列表

使用 `IEngine` 抽象接口统一管理，基类处理 SSE 流式解析、重试、超时；子类仅覆盖 `buildHeaders()` / `buildBody()` / `getBaseUrl()` 差异化方法。

| 分类 | Provider | 协议 | 备注 |
|:---|:---|:---|:---|
| **云端** | OpenAI | OpenAI-compatible | GPT-4.1, GPT-4o 等 |
| | ChatGPT（Web） | Web Session | 零 API 额度消耗 |
| | Azure OpenAI | OpenAI-compatible | 企业用户 |
| | Claude（Anthropic） | Anthropic Messages API | Claude 3.5 Sonnet 等 |
| | Gemini（Google） | Google AI API | Gemini 1.5 Pro 1M |
| | DeepSeek | OpenAI-compatible | 国产高性价比 |
| | MiniMax | OpenAI-compatible | |
| | Moonshot（Kimi） | OpenAI-compatible | 长上下文 |
| | Groq | OpenAI-compatible | 超低延迟 |
| | Cohere | Cohere API | |
| | Cerebras | OpenAI-compatible | 超低延迟 |
| | Perplexity | OpenAI-compatible | 带搜索增强 |
| | xAI（Grok） | OpenAI-compatible | |
| **本地** | Ollama | Ollama REST API | `http://localhost:11434` 零配置接入 |
| | LM Studio | OpenAI-compatible | 本地 OpenAI 兼容服务器 |

#### 2.2.3 多 Provider 故障转移

- 用户可配置主备模型链（如主模型 OpenAI GPT-4o → 备用 Claude → 兜底 DeepSeek）。
- 主模型请求失败或超时（默认 30s 可配置）后，自动按优先级切换到备用模型重试。
- 切换对用户透明，仅在最终成功或全部失败时以 Toast 提示所用模型。
- 错误分层处理：401/403 → 引导检查 API Key；429 → 展示 Rate Limit 冷却时间；5xx → 自动重试 1 次后展示错误。

---

### 2.3 独立页面对话系统（Page-Isolated Chat）

> 设计目标：每个网页拥有独立隔离的对话上下文，支持多模型并发对比，提供高级 AI 对话体验。

#### 2.3.1 URL 绑定机制

- 以网页 URL（去参数后的净网址经 SHA-256 哈希）作为唯一主键 `id`。
- 打开同一 URL 时自动加载该页面的历史对话记录，不同页面的对话彼此完全隔离。

#### 2.3.2 自动 Context 注入

- 提取到的 Markdown 正文作为 `system` 角色消息或隐式 Context 注入大模型，用户无需手动粘贴文章。
- Context 注入顺序：`[系统角色指令] → [页面元数据摘要] → [正文 Markdown 全文] → [历史对话记录] → [用户新消息]`。

#### 2.3.3 多模型并发对比（Arena Mode）

- 输入框上方提供**并发路由选择器**，可同时勾选 1～4 个模型并发执行。
- 侧边栏分栏（1 / 2 / 3 / 4 栏网格）同时渲染不同模型的生成过程，互不阻塞。
- 每个模型卡片底部硬编码显示性能指标：

| 指标 | 说明 | 来源 |
|:---|:---|:---|
| 耗时（ms） | 从发送到接收完成的墙钟时间 | `performance.now()` 差值 |
| TTFT | Time To First Token，首字延迟 | 首 chunk 时间戳 |
| Tokens/s | 每秒生成 Token 数 | 生成量 / 耗时 |
| 价格估算 | API 调用费用估算 | 基于 Provider 定价表 |

#### 2.3.4 流式输出与渲染

- 多模型同时 SSE 流式打字机输出，各模型独立建立 SSE 连接，支持独立重试 / 中止。
- 使用 `eventsource-parser` 流式解析，替代不稳定的原生 EventSource，彻底解决中文多字节字符在网络 Chunks 截断时产生的乱码问题。
- SSE 断线时采用指数退避策略自动重连（初始 1s，最大 30s，上限 5 次），重连携带最后 `event_id`，用户无感知。
- 严禁在每接收一个 SSE chunk 时对全量历史上下文重新执行 `markdown-it.render()`，使用增量字符串追加或 `requestAnimationFrame` 约 16ms 节流重绘，保持生成时帧率 ≥ 45fps。

#### 2.3.5 对话管理

- **重试（Regenerate）**：重新发送最后一条用户消息，支持切换到不同模型重试。
- **编辑用户消息**：双击用户气泡进入编辑模式，保存后自动截断后续消息并重新生成。
- **删除单条消息**：hover 消息气泡时出现删除操作，删除后从 IndexedDB 持久化更新。
- **单分支追问**：点击模型卡片底部"以此继续"，分离出针对该模型的单线对话流。

#### 2.3.6 快捷指令（Prompt 模板）

预设一键操作按钮，排布于输入框下方：

| 指令 | Prompt 摘要 |
|:---|:---|
| 📋 总结摘要 | 用三段话概括文章核心论点 |
| 💡 解释关键概念 | 提取并解释文中所有专业术语 |
| 🎯 提取核心观点 | 提取文章中作者最想表达的 3～5 个核心观点 |
| 🌐 翻译成中文 | 将全文翻译为地道简体中文并保留原有排版 |
| 🔬 红队批判 | 以批判性思维指出文章的逻辑漏洞与不足 |
| 🗺️ 脉络大纲 | 生成完整的章节级结构大纲 |

---

### 2.4 AI 工作流（模型链 / AI Chain）

> 设计目标：允许用户将复杂的阅读任务编排为"流水线"，实现多模型协作、多步骤自动执行。

#### 2.4.1 串行接力（Relay Chain）

配置 2 个模型串行执行：先跑模型 A，A 完成后自动触发模型 B，B 收到 A 的完整输出作为额外上下文。

**示例流水线：**
```
节点 1: [提取正文] → [DeepSeek] → [Prompt: 翻译成中文] → 输出 {{translation}}
    ↓
节点 2: [{{translation}}] → [Claude 3.5 Sonnet] → [Prompt: 提取技术难点] → 输出 {{tech_expl}}
    ↓
节点 3: [汇总 {{translation}} + {{tech_expl}}] → 生成 Markdown 格式输出
```

- 节点间通过 `{{变量名}}` 语法串联。
- 在 Extension Background Service Worker 中顺序执行 Promise 链。
- 每个节点实时流式渲染到对应卡片，用户可实时观察中间产物。
- 支持手动中断任意节点，中断后下游节点自动跳过。

#### 2.4.2 多角色圆桌讨论（Roundtable）

- 用户设定多个角色（🟥 红方挑刺 / 🟩 蓝方辩护 / 🟧 产品落地）。
- 系统将不同 Role Prompt 注入各模型的 System Payload 并发执行，实现跨模型观点交锋。
- 三角色网格布局，一键启动圆桌。

#### 2.4.3 提示词模板系统

支持创建、导入 / 导出（`.json` 格式）、复制提示词模板。模板内置变量系统：

| 变量 | 说明 |
|:---|:---|
| `{{content}}` | 当前页面提取正文 |
| `{{title}}` / `{{author}}` / `{{url}}` | 预置元数据变量 |
| `{{selection}}` | 用户当前划选内容 |
| `{{meta:property:og:title}}` | Meta 变量 |
| `{{schema:@Article.headline}}` | Schema.org 结构化数据变量 |

- 支持基于 URL 匹配规则（简单匹配 / 正则 / Schema.org 类型）自动切换对应模板。
- 变量解析走编译期静态分析而非运行时 `eval()`，杜绝代码注入风险。

#### 2.4.4 Filter 管道（后处理）

模型输出支持后处理管道，内置 40+ Filter：

| 类别 | Filter |
|:---|:---|
| 文本转换 | `capitalize` / `upper` / `lower` / `trim` / `replace` / `strip_tags` / `strip_md` |
| 结构转换 | `blockquote` / `callout` / `table` / `link` / `footnote` |
| 列表操作 | `slice` / `reverse` / `merge` / `join` / `map` / `template` |
| 日期处理 | `date` / `date_modify` |

---

### 2.5 数据历史与资产管理（Library）

> 设计目标：本地优先存储海量阅读历史，支持云端双向同步，数据不绑死任何 SaaS 平台。

#### 2.5.1 历史记录面板

- 独立的"阅读库"标签页（类似书签管理器），按时间倒序或域名分类展示所有抓取并对话过的页面。
- 列表使用 `vue-virtual-scroller` 虚拟滚动，无论底层存了多少万条记录，DOM 树强制只渲染视口可见的约 20 个节点，严禁 `v-for` 全量渲染。
- 每个列表项展示：favicon、页面标题、抓取时间、对话消息数量、字数。

#### 2.5.2 快照查看

- 点击历史记录进入阅读模式，分 Tab 展示：
  - **Tab 1 - 文章快照**：当时提取的正文 Markdown 全文（即使原网页已失效被删除，本地数据依然可用）。
  - **Tab 2 - 对话历史**：完整的历史对话记录，支持重新发送消息继续对话。
- 列表仅加载主表元数据（<5ms），点击后才懒加载副表完整对话 JSON（含百万 Token 级别长文本），严禁在列表页查副表。

#### 2.5.3 全文检索

- 支持全文检索（搜索文章标题、正文或对话记录中的关键词）。
- 检索逻辑放入原生 `Web Worker`，查询完毕后通过 `postMessage` 将匹配到的摘要高亮切片回传 Vue 渲染，避免主线程假死。
- 搜索结果高亮：`#fff299` 背景色 + `#5c4a00` 文字。

---

### 2.6 跨设备备份与全量恢复

> 设计目标：数据完全可携带，支持导出为通用格式，不仅用于扩展恢复，也可被脚本解析转换为 Obsidian / Notion 格式。

#### 2.6.1 全量导出（本地备份）

- 通过 `jszip` 在 Web Worker 中打包 Dexie 全量数据为 `.zip` 下载，Worker 线程展示压缩进度条。
- 备份包含：所有网页元数据、正文快照（Markdown 格式）、完整对话记录（JSON）。
- 导出的 JSON 格式标准（见第 4 节），可被外部脚本解析转换。

#### 2.6.2 全量导入与合并

- 支持在新浏览器 / 新电脑上导入备份文件。
- 支持两种合并策略：
  - **覆盖合并**：以导入数据为准，覆盖本地同 URL 的记录。
  - **跳过重复项**：保留本地数据，仅导入本地不存在的记录。

#### 2.6.3 WebDAV / S3 双向同步

- 支持用户配置坚果云、Nextcloud 或自建 S3 服务。
- **导出（上传）**：利用 `webdav` npm 库，通过 REST API 将 Markdown 增量 `PUT` 到云端指定文件夹。
- **导入（下载）**：从云端拉取配置、Prompt 模板、历史快照。
- 同步策略支持手动触发和 `chrome.alarms` 定时自动同步（默认每 7 天凌晨 3 点静默灾备）。

#### 2.6.4 Obsidian 直写 / 本地文件导出

- **直接写入 Obsidian**：通过 `obsidian://new?vault=[库名]&file=[标题]&content=[内容]` URI Scheme。
- **保存为本地文件**：通过浏览器下载 API，支持 `.md` / `.html` / `.txt` 格式。
- **复制到剪贴板**：一键复制 Markdown 渲染结果或原始文本。
- 自动生成 YAML Frontmatter（含 `title`、`source_length`、`engine`、`truncation`、`models_applied` 字段）。

#### 2.6.5 浏览器间设置同步

- 利用 `chrome.storage.sync` + `lz-string` 压缩分片（CHUNK_SIZE=8000），将模板、Provider 配置、快捷键设置同步到同一账号的其他浏览器，突破 `storage.sync` 单 Key 8KB 限制。

---

### 2.7 RSS 自动化阅读器

> 设计目标：主动筛选、预处理信息，实现"打开浏览器即可阅读已由 AI 摘要好的内容"。

#### 2.7.1 工作流

1. 用户在 Dashboard 中添加 RSS Feed URL。
2. Service Worker 利用 `chrome.alarms` 定时拉取 RSS（默认每 30 分钟，可配置）。
3. 利用哈希对比去重，检测到新文章后，**在后台直接请求 AI 模型**，生成 200 字极简摘要。
4. 用户打开浏览器时，在"今日简报"中阅读已由 AI 摘要好的内容，点击感兴趣的再看全文。

#### 2.7.2 RSS 面板展示

每条 Feed 展示：
- 标题 + 未读计数 badge
- AI 生成的 3 句话短总结（`bg-obsidian-bg` + `border` + `rounded-lg`，`text-[11px]`）
- 来源 / 时间 + "以此开启对话"紫色软按钮（将 RSS 内容作为对话上下文）

#### 2.7.3 今日简报（Daily Briefing）

- 每日首次打开浏览器时，系统自动汇总当天所有 RSS 新文章的 AI 摘要，生成"今日简报" Markdown。
- 支持一键导出到 Obsidian，用户可在简报中标记感兴趣的文章，系统自动拉取全文并开启 AI 深度对话。

---

## 3. UI / UX 交互设计

> 视觉规范以 `design.html` 为准，以下为组件级交互细节补充。所有颜色 / 间距 / 字体参见 `design-tokens.md`。

### 3.1 扩展主要入口

#### 3.1.1 Popup 弹窗（扩展轻量端）

- 固定宽度 330px，白色背景 + `border-obsidian-borderStrong` + `shadow-2xl` + `rounded-2xl`。
- **顶部标题栏**：`bg-obsidian-card` + `border-b`，展示扩展图标和标题。
- **内容区**：
  - 当前浏览器活动页信息卡片（标题、本地字数、预估 Context Token）。
  - 双操作按钮：【触发一键解析】紫色主按钮 + 【Options 设置页】白色边框按钮。
- Popup 出现动画：`scale 0.95 → 1 + opacity`，150ms `ease-out`。

#### 3.1.2 Side Panel 侧边栏（核心主界面）

采用 Chrome Side Panel API，不遮挡原网页，边看边聊。三区布局：

```
┌─────────────────────────────────┐
│  Header（上下文锚定栏 64px）      │
├─────────────────────────────────┤
│  提取状态条                       │
├─────────────────────────────────┤
│                                  │
│  Chat View（消息流，可滚动）       │
│                                  │
├─────────────────────────────────┤
│  Input Box（输入区）              │
└─────────────────────────────────┘
```

#### 3.1.3 Options 设置页（管理面板）

- 类浏览器历史记录的宽屏大面板，分 Tab 布局管理：Provider 密钥、提示词模板、同步与备份凭据、RSS 订阅源。
- 左侧列表：网页标题、抓取时间。
- 右侧分屏展示 Tab 1（提取正文）+ Tab 2（对话历史）。

---

### 3.2 桌面端三栏布局

```css
grid-template-columns: 250px 1fr 360px;
gap: 12px;
padding: 12px;
height: 100vh;
```

| 栏位 | 宽度 | 内容 |
|:---|:---|:---|
| 左栏 | 固定 250px | 品牌区 + 主导航 + 技术上下文 |
| 中栏 | 1fr | 主工作区（可切换 Chat / Panel 视图） |
| 右栏 | 固定 360px | 选项与工具面板（含标签页切换） |

**响应式断点：**
- `< 1250px`：隐藏右栏（右栏内容并入中栏 Panel 视图）
- `< 820px`：隐藏左栏（左栏导航折叠为顶部抽屉 / 按钮）
- 移动端：单列布局

---

### 3.3 顶部上下文锚定栏（Header）

- 高度 64px，`border-b border-obsidian-border`。
- **左侧**：40px 圆角 favicon 图标（边框背景）+ 页面标题 `text-xs font-bold` + 状态标签（已提取字数 badge）。
- **右侧**："模拟切换网页"边框按钮 + "提取当前 Tab"紫色主按钮（`rounded-xl` + `shadow-sm`）。

**模型切换下拉框（右侧附加）：**
- 下拉框显示当前选中模型名称 + 厂商色点。
- 展开后分组展示（云端 / 本地），已配置的 Provider 高亮。

---

### 3.4 全局提取状态条

- 上下文锚定栏下方，`bg-obsidian-bg/60`，高度约 32px。
- 展示信息：提取引擎（`Readability` / `Defuddle` / `Fallback`）、数据库状态（`IndexedDB`）、字数统计。
- `No Truncation` badge：`bg-obsidian-greenSoft` + `text-obsidian-green` + `rounded-full`，`text-[10px] font-bold uppercase tracking-wider`。

---

### 3.5 对话消息区（Chat View）

#### 3.5.1 用户气泡

- 白色背景 + `border-obsidian-border` + `rounded-2xl rounded-tr-sm`，最大宽度 78%，右对齐，`text-xs`。
- 顶部第一条消息为系统生成的"页面摘要"卡片，可点击展开查看提取的原文章。

#### 3.5.2 模型并发网格

- 默认单列，响应式 `md:grid-cols-2`（2 模型时）。
- **卡片结构：**

```
┌──────────────────────────────────────────┐
│ Header: 色点 + 模型名 + 状态 badge        │
├──────────────────────────────────────────┤
│                                          │
│  Body: Markdown 渲染区（min-h: 140px）   │
│  流式光标: ▋ animate-pulse               │
│                                          │
├──────────────────────────────────────────┤
│ Footer: TTFT | TPS | Cost | 以此继续/中止│
└──────────────────────────────────────────┘
```

- 卡片：白色背景 + `border-obsidian-border` + `rounded-2xl` + `shadow-sm`。
- Footer 指标：等宽字体 `text-[10px]`，`text-obsidian-muted`。
- 缓存命中时标注 `⚡ Cached`，`text-obsidian-green`。

#### 3.5.3 流式光标

```css
.typing-cursor::after {
  content: "▋";
  color: var(--obsidian-primary);
  animation: pulse 2s infinite;
}
```

---

### 3.6 底部输入区（Input Box）

```
┌──────────────────────────────────────────────────┐
│ [模型路由选择器：药丸 chips，可多选，横向换行]     │
├──────────────────────────────────────────────────┤
│ [多行文本域，rounded-xl，56px min，128px max]     │
│                                    [发送] [⎋ 中断] │
├──────────────────────────────────────────────────┤
│ [快捷指令栏: 总结摘要 / 红队批判 / 圆桌交锋 ...]  │
└──────────────────────────────────────────────────┘
```

- **并发模型路由选择器**：横向换行 chips，每个 chip 为 `rounded-full` 药丸，包含复选框 + 模型名 + 厂商色点。
- **文本域**：`rounded-xl`，最小高度 56px，最大高度 128px，`resize-y`，`text-xs`，`border-obsidian-border`，聚焦态 `focus:border-primary/50 focus:ring-4 focus:ring-primary/10`。
- **发送按钮**：紫色主按钮 `bg-obsidian-primary`，白色文字，`rounded-xl`，`shadow-sm`。
- **快捷指令栏**：`text-[10px]` 带下划线的文字按钮，支持圆桌交锋、串联接力两种工作流快速启动。

---

### 3.7 右栏标签页面板

顶部 6 等分标签栏：**历史 / RSS / 工作流 / 导出 / 设置 / 架构**

| 状态 | 样式 |
|:---|:---|
| 激活态 | 下边框 `border-b-2 border-obsidian-primary`，文字 `text-obsidian-primary`，背景白色 |
| 未激活态 | 边框透明，文字 `text-obsidian-muted`，hover `text-obsidian-text` |

字体：`text-[11px] font-extrabold`

**各标签内容卡片规范：**
- 白色背景 + `border-obsidian-border` + `rounded-xl` + `space-y-2.5`
- 标题：`text-xs font-bold text-obsidian-text`
- 描述：`text-[10px] text-obsidian-muted leading-relaxed`
- 输入框：`border-obsidian-border rounded-lg text-xs`，padding 约 6～10px
- 按钮组：白色 / 紫色边框按钮，小尺寸

---

### 3.8 弹窗 Modal

- 遮罩：`rgba(0,0,0,0.35)` + `backdrop-blur-sm`。
- 弹窗容器：白色背景 + `border-obsidian-border` + `rounded-2xl` + `shadow-2xl`。
- 标题栏：`bg-obsidian-card` + `border-b`。
- 底部操作栏：`bg-obsidian-bg` + `border-t`。
- 主按钮：`bg-obsidian-primary`。
- 出现动画：`scale 0.95 → 1 + opacity`，150ms `ease-out`；消失：100ms `ease-in`。

---

### 3.9 Toast 通知

- 底部居中，深色背景 `#2d2c29`，白色文字，`rounded-full`，`shadow-2xl`。
- 左侧带 pulsing 色点（成功绿色 / 错误红色 / 进行中紫色）。
- 出现动画：`translate-y 3px → 0 + opacity`，150ms。

---

### 3.10 左栏品牌区与导航

**品牌区（顶部 64px header）：**
- 品牌图标：40px 圆角矩形，渐变 `from-obsidian-primary to-[#8fa6ff]`，白色文字 `AR`。
- 品牌标题：`font-black text-sm`，版本号 `text-[10px] text-obsidian-muted`。

**导航按钮：**
| 状态 | 样式 |
|:---|:---|
| 激活态 | `bg-obsidian-primarySoft`，文字 `text-obsidian-primary`，`border border-[#d2d6ff]`，`font-extrabold`，`rounded-xl` |
| 未激活态 | 透明背景，文字 `text-obsidian-text`，hover `bg-obsidian-bg` |

- 图标：左侧 16px SVG，文字 `text-xs`。
- RSS 未读计数：右侧 `rounded-full` badge，`bg-obsidian-primary`，白色文字 `text-[9px]`。

---

### 3.11 交互与动画规范

| 场景 | 规范 |
|:---|:---|
| 通用过渡 | 150ms `ease-out` 进入，100ms `ease-in` 离开 |
| Popup / Modal | `scale 0.95 → 1` + `opacity 0 → 1` |
| Toast | `translate-y 3px → 0` + `opacity 0 → 1` |
| 按钮 hover | 背景色变化 / 透明度变化，无延迟 |
| 旋转加载 | `animate-spin` |
| 脉冲点 | `animate-ping` / `animate-pulse` |
| 进度条 | 紫色填充，150ms 过渡 |

---

## 4. 底层数据结构设计

### 4.1 存储引擎选型

**强制使用 IndexedDB**（通过 `Dexie.js` 库封装），弃用容易触发 5MB 配额限制的 `chrome.storage.local`，支持存储 1GB+ 的图文阅读历史。

### 4.2 核心表结构（主副表读写分离）

#### 主表：`Conversations`（元数据，查询极快 <5ms）

```typescript
interface Conversation {
  id: string;          // hash(url)，SHA-256 唯一 ID
  url: string;         // 原始链接
  title: string;       // 页面标题
  favicon: string;     // 图标 URL
  domain: string;      // 域名，用于分类
  createdAt: number;   // 首次抓取时间戳（ms）
  updatedAt: number;   // 最后对话时间戳（ms）
  wordCount: number;   // 正文字数
  engine: string;      // 提取引擎：'readability' | 'defuddle' | 'fallback'
  messageCount: number; // 对话消息总数（不含系统消息）
  models: string[];    // 本次对话用过的模型列表
}
```

#### 副表：`Messages`（完整数据，仅点击时懒加载）

```typescript
interface MessageStore {
  id: string;              // 与 Conversation.id 相同
  rawText: string;         // 提取的正文（Markdown 格式）
  metadata: {
    author?: string;
    published?: string;
    description?: string;
    ogImage?: string;
    schemaType?: string;   // Schema.org 类型，如 '@Article'
  };
  chatHistory: Message[];  // 完整对话记录
}

interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp: number;
  // assistant 专属字段
  model?: string;          // 如 'gpt-4o' / 'claude-3-5-sonnet'
  provider?: string;       // 如 'openai' / 'anthropic'
  ttft?: number;           // Time to First Token（ms）
  tps?: number;            // Tokens per second
  cost?: number;           // 费用估算（USD）
  cached?: boolean;        // 是否命中 L3 缓存
}
```

#### 其他表

```typescript
// 高亮选区（按域名分组，跨会话持久化）
interface Highlight {
  id: string;
  pageId: string;          // 关联 Conversation.id
  domain: string;
  selector: string;        // CSS selector 定位高亮元素
  text: string;            // 高亮内容文本
  style: string;           // 样式类型：'mark' | 'underline' | 'blur' 等
  createdAt: number;
}

// RSS 订阅源与缓存文章
interface RSSFeed {
  id: string;
  url: string;             // RSS Feed URL
  title: string;
  fetchInterval: number;   // 拉取间隔（分钟）
  lastFetched: number;     // 上次拉取时间
  articles: RSSArticle[];
}

interface RSSArticle {
  id: string;              // hash(link)
  link: string;
  title: string;
  summary: string;         // AI 生成的 200 字摘要
  publishedAt: number;
  isRead: boolean;
}

// 提示词模板
interface Template {
  id: string;
  name: string;
  icon: string;
  prompt: string;          // 含 {{变量}} 语法
  urlPattern?: string;     // URL 触发规则（正则）
  filters?: string[];      // Filter 管道配置
  createdAt: number;
}
```

### 4.3 三级缓存策略

| 层级 | 存储介质 | 缓存内容 | 淘汰策略 | TTL |
|:---:|:---|:---|:---|:---|
| L1 内存 | JS Map（LRU） | 当前页面提取结果、最近 5 次 API 响应 | LRU | 页面关闭即释放 |
| L2 持久化 | IndexedDB | 相同 URL 的页面提取结果和元数据 | TTL 过期 | 默认 24h |
| L3 API 响应 | IndexedDB | 相同 Query + 页面上下文的 API 结果 | Content Hash 匹配 | 手动清除 |

- L2 缓存命中时避免重复执行提取（节省 2～8s）。
- L3 缓存适用于频繁切换模型对比同一问题的场景，命中时底栏标注 `⚡ Cached`。

### 4.4 完整 PageRecord 示例（备份格式）

```json
{
  "id": "a3f9b2c1d4e5f6a7",
  "url": "https://example.com/article/ai-trends-2025",
  "title": "2025 年 AI 行业十大趋势",
  "favicon": "https://example.com/favicon.ico",
  "domain": "example.com",
  "createdAt": 1715000000000,
  "updatedAt": 1715001200000,
  "wordCount": 4200,
  "engine": "readability",
  "content": {
    "rawText": "# 2025 年 AI 行业十大趋势\n\n作者：张三...",
    "metadata": {
      "author": "张三",
      "published": "2025-01-15",
      "description": "深度分析 2025 年 AI 行业最重要的十大变革趋势",
      "ogImage": "https://example.com/og-image.jpg",
      "schemaType": "@Article"
    }
  },
  "chatHistory": [
    {
      "role": "user",
      "content": "请总结这篇文章的三个核心论点",
      "timestamp": 1715000100000
    },
    {
      "role": "assistant",
      "model": "gpt-4o",
      "provider": "openai",
      "content": "核心论点如下：\n1. 多模态大模型成为主流...",
      "timestamp": 1715000120000,
      "ttft": 380,
      "tps": 45.2,
      "cost": 0.0023,
      "cached": false
    }
  ]
}
```

---

## 5. 技术选型矩阵

| 技术维度 | 选型方案 | 引入理由 |
|:---|:---|:---|
| **基础工程框架** | `WXT` (v0.19.x) | 基于 Vite，完美支持 MV3，对 Popup / Side Panel / 后台脚本提供开箱即用 HMR |
| **视图层框架** | `Vue 3` (SFC) + TypeScript | 组合式 API 便于多模型网格渲染的复用与解耦，TS 强类型降低大文本 Payload 组装出错率 |
| **样式与 UI 库** | `UnoCSS` + `Reka UI` | UnoCSS 零 runtime 开销，Reka UI 无样式原语便于像素级还原冷淡风视觉 |
| **多 Provider 引擎** | 自研 `IEngine` 接口 + 适配器 | 基类统一处理 SSE / 重试 / 超时，子类仅覆盖差异化方法 |
| **正文提取** | `@mozilla/readability` + `defuddle` + `turndown` | Readability 本地毫秒级提取，defuddle 兜底一步完成 DOM → Markdown |
| **流式解析** | `eventsource-parser` | 解决中文多字节字符在 Chunks 截断时的乱码问题（生产验证） |
| **增量 JSON 解析** | `best-effort-json-parser` | 流式场景下解析不完整 JSON 响应 |
| **海量数据库** | `Dexie.js` | 规避 5MB 限制，支持 GB 级存储，百万 Token 级超长文本检索 |
| **跨浏览器兼容** | `webextension-polyfill` | 一套代码同时打包 Chromium / Firefox / Safari |
| **MD 渲染引擎** | `markdown-it` | 高性能，配合流式输出快速将 LLM 文本转为 HTML |
| **XSS 防护** | `DOMPurify` | 渲染大段模型输出及 RSS 抓取的外部 HTML 时强制净化 DOM |
| **模板压缩** | `lz-string` | 压缩模板 JSON 至 UTF16，突破 `chrome.storage.sync` 单 Key 8KB 上限 |
| **日期处理** | `dayjs` | 轻量级日期格式化与相对时间展示 |
| **语音合成** | Web Speech API / Edge TTS | 30+ 语言朗读，零额外依赖 |
| **状态管理** | `Pinia` + `PersistedState` | 基于 `chrome.storage.local` 序列化，保障 Popup 与 Side Panel 状态秒级互通 |
| **虚拟滚动** | `vue-virtual-scroller` | 万条历史记录仅渲染视口可见节点 |
| **ZIP 打包** | `jszip` | Web Worker 中打包 Dexie 全量数据为 `.zip` |
| **WebDAV 同步** | `webdav` npm 库 | REST API 将 Markdown 增量 PUT 到坚果云 / Nextcloud |

---

## 6. 关键架构约束（红线）

### 6.1 列表渲染内存熔断

侧边栏历史记录列表必须引入 `vue-virtual-scroller`，DOM 树强制只渲染视口可见的约 20 个节点，**严禁 `v-for` 全量渲染**。

### 6.2 数据库读写分离与超长文本懒加载

**严禁在列表页查副表 `Messages`**，仅当用户点击某条记录进入阅读模式时，才按 ID 懒加载并放入内存。主表 `Conversations` 查询目标 <5ms。

### 6.3 全文检索 Web Worker 隔离

搜索逻辑必须放入原生 `Web Worker`，通过 `postMessage` 回传匹配摘要。严禁在主线程对万条长文本执行正则，避免 GUI 线程假死（60fps）。

### 6.4 流式渲染节流

严禁在每个 SSE chunk 时对庞大的全量历史上下文重新执行 `markdown-it.render()`。使用增量字符串追加（Append）或 `requestAnimationFrame` 约 16ms 节流重绘，保持生成时帧率 ≥ 45fps。

### 6.5 多 Provider 请求调度

每个 Provider 的 SSE 连接绑定独立 `AbortController`，用户中止或超时时精准关闭对应连接，不影响其他模型。错误码分层：401/403 → 引导检查 API Key；429 → 展示冷却时间；5xx → 自动重试 1 次。

### 6.6 Shadow DOM 注入隔离

浮动工具栏和右键注入 UI 全部使用 Shadow DOM 承载，配合 CSS Modules 命名隔离，**不得**影响宿主页面样式。

### 6.7 模板引擎安全

变量解析走编译期静态分析而非运行时 `eval()`，Filter 链严格控制白名单，**不得**执行任意 JavaScript。

---

## 7. 版本演进路线（Roadmap）

| 阶段 | 版本 | 核心交付 | 里程碑 |
|:---:|:---:|:---|:---|
| MVP | v0.5 | 三级正文提取 + 单模型对话 + 上下文锚定 + IndexedDB 存储 | 基础可用 |
| Alpha | v0.8 | 多模型并发对比（Arena）+ 流式渲染 + 提示词模板 + Obsidian 导出 | 核心差异化 |
| Beta | v1.0 | AI 工作流（Relay Chain）+ 翻译 / 润色 / 总结 + 高亮选区 + WebDAV 同步 | 功能完整 |
| GA | v1.2 | RSS 自动化 + 今日简报 + 智能缓存 + 浏览器间同步 | 体验打磨 |
| Future | v2.0 | Tauri 桌面端 + 沉浸式双语翻译 + 框选模式 + 用户脚本模式 | 生态扩展 |
