---
AIGC:
    Label: "1"
    ContentProducer: 001191440300708461136T1XGW3
    ProduceID: d270bcd3df6a2cd27c2792fa9a0b45ef_5ff017b56d8a11f1aa625254006c9bbf
    ReservedCode1: HMbcPNjvkIxiZnBXRvczTKIycwwDLrk0baQthXvBtpG6RvUdo5Pq/f0NB/BIhG6d1LTWAK/PKqItvboZPjgVPliINM0SLPYs08YbynVbhjJIojuyH94GgyKipZebgjEBeqN4YN4PZDPU4Atd+0Oe0hMr1DDCWqAKcK0u8YkvihjGOhyRz8RY7ugY0j8=
    ContentPropagator: 001191440300708461136T1XGW3
    PropagateID: d270bcd3df6a2cd27c2792fa9a0b45ef_5ff017b56d8a11f1aa625254006c9bbf
    ReservedCode2: HMbcPNjvkIxiZnBXRvczTKIycwwDLrk0baQthXvBtpG6RvUdo5Pq/f0NB/BIhG6d1LTWAK/PKqItvboZPjgVPliINM0SLPYs08YbynVbhjJIojuyH94GgyKipZebgjEBeqN4YN4PZDPU4Atd+0Oe0hMr1DDCWqAKcK0u8YkvihjGOhyRz8RY7ugY0j8=
---

# 📄 AI Reader — 产品需求文档 (PRD)

> **文档版本**：v3.2 (Browser-Native Workflows)
> **产品定位**：浏览器端的全自动化 AI 阅读、比对与综合提炼助手。
> **核心原则**：本地优先、Cherry 多模态交互、海量数据吞吐架构、零中转直连、**无截断长文本支持**。
> **参考项目**：本需求文档基于以下开源项目的成熟工程实践进行功能细化：
> - [nextai-translator](https://github.com/nextai-translator/nextai-translator)（浏览器扩展 + Tauri 桌面端）
> - [obsidian-clipper](https://github.com/obsidianmd/obsidian-clipper)（Obsidian 官方 Web Clipper）
> - [Read Frog（陪读蛙）](https://github.com/mengxi-ream/read-frog)（沉浸式双语翻译与语言学习）
> - [iFocal](https://github.com/Tokinx/iFocal)（网页内翻译 + 独立 AI 助手窗口）
> - [WebChatAI](https://github.com/linuxhsj/WebChatAI)（选区浮动工具栏 + 脑图生成）
> - [Page Assist](https://github.com/nicepkg/page-assist)（本地 AI 侧边栏交互）
> - [Cherry Studio 浏览器扩展](https://github.com/CherryHQ/cherry-studio)（多模型协作 + 智能缓存 + WebSocket 通信）
- [EasyChat](https://github.com/starwingChen/easyChat)（不到 1MB 的 Chrome 侧边栏插件，多模型并排对比 + Web 会话复用，零 API 额度消耗）
- [ChatGPTBox](https://github.com/josStorer/chatGPTBox)（浏览器 AI 助手，多模型路由 + 浮动工具栏 + 右键菜单 + 多站点适配）
- [Sider AI](https://sider.ai)（千万用户级浏览器 AI 侧边栏，多模型对比 + 页面感知 + 深度研究）

---

## 一、 系统入口与布局职责

*   **Popup (弹窗)**：轻量控制器。展示当前网页预估字数，提供"快速触发提取"和"进入设置"入口。借鉴 nextai-translator Popup 模式：单一入口、简洁交互、API Key 快速配置。
*   **Side Panel (侧边栏)**：核心主界面。采用类 Obsidian 视觉风格。承载上下文状态、Cherry 风格多模对话视图、历史记录面板。借鉴 obsidian-clipper 的 Side Panel 架构：通过 `window.location.pathname` 判断 `side-panel.html` 上下文，实现独立渲染管线。
*   **Options (设置页)**：分 Tab 布局。管理 Provider 密钥、提示词模板、同步与备份凭据、RSS 订阅源。借鉴 obsidian-clipper 的 `general-settings` / `interpreter-settings` / `reader-settings` 分模块管理模式。
*   **全局快捷键**：
    *   `Alt/Option + S`：自动唤起侧边栏，静默提取当前页面并执行默认提示词。
    *   `Alt/Option + P`：显隐侧边栏。
    *   `Escape`：一键中断当前所有网络生成请求。
    *   借鉴 nextai-translator 的 Tauri `global-shortcut` 插件模式，跨平台快捷键一致性。

---

## 二、 核心业务规格 (Functional Specs)

### 模块 1：上下文提取与无界锚定 (Context & Extraction)

*   **三级降级正文提取算法**：

    1.  **本地首选 (`defuddle`)**：借鉴 obsidian-clipper 的内容提取管线。优先使用 `defuddle` 库在本地执行解析，其内置的 `createMarkdownContent` 可直接将网页正文转为结构化 Markdown，剥离广告、导航栏等噪音。defuddle 相比 Readability 的优势在于原生 Markdown 转换能力，无需额外的 `turndown` 桥接步骤。

    2.  **API 异步解析 (Defuddle 远程)**：若本地 defuddle 提取异常或返回空内容，调用 Defuddle 服务端接口执行智能提取（设定 8 秒超时限制）。复用 obsidian-clipper 已验证的 `extractPageContent` + `initializePageContent` 双阶段提取模式，先获取基础元数据再异步加载正文。

    3.  **兜底提取 (`innerText`)**：若前两步均失败或超时，强制清洗 DOM 树中的 `<script>` 与 `<style>` 节点后，直接提取 `document.body.innerText`。

*   **结构化元数据提取（新增）**：借鉴 obsidian-clipper 的五类变量系统，提取页面时同步采集：
    - **Preset 预置变量**：`title`、`author`、`description`、`published`、`site`、`domain`、`favicon`、`image`（社交分享图）、`words`（字数统计）
    - **Meta 元变量**：通过 `<meta>` 标签提取 Open Graph 数据（`og:title`、`og:description`、`og:image` 等）
    - **Schema.org 结构化数据**：解析页面 JSON-LD / Microdata，提取类型化信息（如 `@Recipe`、`@Article`、`@Product`），用于智能分类和上下文增强
    - 以上元数据作为系统预置变量注入 Prompt 上下文，提升 AI 理解精度

*   **高亮选区提取（新增）**：借鉴 obsidian-clipper 的 Highlighter 系统：
    - 用户在页面上划选文本/图片/元素后，自动识别选区并支持三种内容模式：①嵌入高亮标记的完整正文（`==highlight==` 语法）；②仅提取高亮内容列表；③忽略高亮保持原文
    - 高亮数据跨会话持久化存储（Dexie.js），用户关闭页面后再次打开仍可恢复
    - 高亮数据可按域名分组管理，支持 `.json` 导出
    - **多种标记样式预设（借鉴 iFocal）**：支持点状下划线、高亮背景色、模糊、波浪线、弱化、边框、分割线、斜体、加粗以及自定义 CSS，用户可为不同用途（重点/疑问/待办）绑定不同样式

*   **选区交互增强（新增，借鉴 WebChatAI + Cherry Studio + iFocal）**：
    - **浮动工具栏**：页面上划选文本后自动弹出轻量浮动工具栏，提供解释/总结/翻译/提问四个快捷操作。借鉴 WebChatAI 的选区浮动工具栏方案：工具栏定位在选区附近，自动避开边缘区域，用户点击页面空白处自动消失。
    - **右键菜单集成**：选中文本后，浏览器右键菜单中注入 AI 操作项（解释/总结/翻译/朗读/搜索），借鉴 Cherry Studio 扩展的右键菜单模式。通过 `chrome.contextMenus` API 动态注册，仅在有选区时显示。
    - **Shadow DOM 隔离（借鉴 iFocal）**：浮动工具栏和右键注入 UI 均使用 Shadow DOM 承载，配合样式命名隔离（BEM 或 CSS Modules），彻底避免注入的 UI 组件与宿主页面 CSS 发生冲突，确保在任何网页上均保持一致的视觉表现。

*   **无限制上下文直通 (No Truncation)**：
    *   **不设硬性字符/Token上限**。为了充分利用现代大模型（如 Gemini 1M+, Claude 200k+）的超长文本处理能力，系统**严禁**在前端对提取的文章内容进行人为截取或丢弃。由底层模型 API 自行决定是否超出 Token 限制。

*   **上下文静默锚定机制**：
    *   侧边栏顶部常驻**"当前上下文状态栏"**。切换浏览器 Tab 时，系统**静默保持**上一次提取的网页作为对话上下文，不打断原有对话流。
    *   提供【⟳ 刷新提取当前 Tab】按钮，供用户主动更新上下文。

### 模块 2：Cherry 风格多模型工作区 (Workspace)

*   **多 Provider 引擎架构（参考 nextai-translator）**：
    *   借鉴 nextai-translator 的 `engines/` 模块设计，使用 `IEngine` 抽象接口统一管理多 Provider。
    *   支持 Provider 列表（不少于 14 个）：OpenAI / ChatGPT / Azure OpenAI / Gemini / Claude (Anthropic) / DeepSeek / MiniMax / Moonshot / Ollama（本地模型）/ Groq / Kimi / ChatGLM / Cohere / Cerebras / Perplexity / xAI。
    *   每个 Provider 独立配置 API Key、Base URL、模型列表，借鉴 obsidian-clipper 的 `providers.json` 预设方案（含 `apiKeyUrl`、`modelsList`、`popularModels` 等元数据），用户无需手动查找文档即可完成配置。

*   **全局并发路由**：输入框上方提供下拉器，可同时勾选 1~4 个模型并发执行。借鉴 obsidian-clipper Interpreter 的多 Provider 请求调度逻辑（各 Provider 独立构建 Request Body 和 Headers，适配 OpenAI-compatible / Anthropic / Ollama 等不同协议格式）。

*   **聚合流式渲染**：
    *   在一个用户提问气泡下方，按选中的模型生成"并排栏目"或"内嵌标签页"。
    *   各模型独立建立 SSE 连接，流式渲染互不阻塞。支持独立重试/中止。
    *   借鉴 nextai-translator 已验证的 `eventsource-parser` 流式解析方案：替代不稳定的原生 EventSource，彻底解决多字节字符（中文）在网络 Chunks 截断时产生的乱码与格式断裂问题。搭配 `best-effort-json-parser` 处理不完整 JSON 增量。

*   **数据透视底栏**：模型卡片底部硬编码显示：`耗时(ms)` | `TTFT` | `Tokens/s` | `消耗量预估`。借鉴 obsidian-clipper Interpreter 的 `formatDuration` 计时和 `updateTokenCount` 的 Token 估算机制。

*   **单分支追问**：点击某模型卡片底部的"以此继续"，分离出针对该模型的单线对话流。

*   **提示词模板系统（新增，借鉴 obsidian-clipper Templates）**：
    *   支持创建、导入/导出（`.json` 格式）、复制提示词模板
    *   模板内置 **变量系统**：
        - `{{content}}`：当前页面提取正文
        - `{{title}}` / `{{author}}` / `{{url}}` 等预置变量自动填充
        - `{{selection}}`：用户当前划选内容
        - `{{meta:property:og:title}}` 等 Meta 变量
        - `{{schema:@Article.headline}}` 等结构化数据变量
    *   模板支持 **URL 触发规则**：基于当前页面 URL 的简单匹配 / 正则匹配 / Schema.org 类型匹配，自动切换对应模板
    *   模板行为：新建笔记 / 追加到已有 / 追加到日记（借鉴 obsidian-clipper 的 behavior 模式）

*   **Filter 管道（新增，借鉴 obsidian-clipper 40+ Filter 系统）**：模型输出支持后处理管道：
    - **文本转换**：`capitalize`、`upper`、`lower`、`trim`、`replace`、`strip_tags`、`strip_md`、`safe_name`
    - **结构转换**：`blockquote`（转引用块）、`callout`（转 Callout 语法）、`table`（转表格）、`link`（转 Wiki 链接）、`footnote`（转脚注）
    - **列表操作**：`slice`、`reverse`、`merge`、`join`、`map`、`template`
    - **日期处理**：`date`、`date_modify`

### 模块 3：高阶 AI 工作流 (Advanced Workflows)

*   **多模型并排对比 (Multi-Model Compare)**（借鉴 EasyChat 并发广播模式）：用户一次输入，广播给所有勾选的模型**纯前端并发执行**——几个模型就发几个并发 API 请求，无后端依赖。每个模型卡片独立配置 System Prompt（实现不同"角色视角"，如红方挑刺 / 蓝方辩护），结果并排展示。支持拖拽调整 1/2/3/4 栏布局。每个卡片独立操作：单独重试、中止、复制、追问。对话可保存为只读"历史快照"，方便回溯对比。

*   **模型接力链 (Relay Chain)**（两种轻量形式，纯前端 Promise 链串接，不引入工作流引擎）：
    - **形式 A — 追问接力**：点击某模型卡片底部的"以此继续"，将该模型输出作为新对话上下文，切换到另一个模型继续提问。这是 UI 交互便利，无自动管线。
    - **形式 B — 串行对比**：配置 2 个模型串行执行（先跑 A 模型，A 完成后自动触发 B 模型，B 收到 A 完整输出作为额外上下文）。前端用 `Promise` 链串起两段异步调用即可。

*   **AI 页面解释器（新增，借鉴 obsidian-clipper Interpreter）**：在以上两种工作流之外，引入轻量级"解释器"模式，面向单次问答而非持续对话：
    - 用户定义 Prompt 变量（如 `{{"用三句话总结这篇文章"}}`、`{{"提取文中的所有人名和地名"}}`）
    - 系统将页面上下文 + Prompt 变量打包为单次 API 请求
    - 支持批量 Prompt：一次请求同时处理多个 Prompt，模型以 JSON 格式返回结果并自动回填到模板对应位置
    - Prompt 输出同样支持 Filter 管道后处理

*   **翻译 / 润色 / 总结三合一模式（借鉴 nextai-translator + Read Frog）**：
    - 借鉴 nextai-translator 的 `TranslateMode` 设计（`translate` / `polishing` / `summarize` / `analyze` / `explain-code` / `big-bang`）
    - 翻译模式：支持 55+ 语言互译，带语言自动检测与 Quote 智能处理
    - **沉浸式双语翻译（借鉴 Read Frog）**：在网页原文元素旁直接显示译文，保留原始排版布局，支持双语对照 / 仅译文两种模式切换。通过自定义 CSS 调整翻译文本的颜色、字体、边框等样式。翻译结果分批插入 DOM，不阻塞页面渲染。
    - **智能批量请求合并（借鉴 Read Frog）**：全文翻译场景下，将页面内多个翻译块合并为单次 API 请求，通过 Prompt 拼接 + JSON 结构化返回一次性获取所有翻译结果，API 调用成本最高可节省 70%。同样适用于批量划词解释场景。
    - 润色模式：语法修正、风格优化、学术写作辅助
    - 总结模式：可指定输出格式（段落 / 要点 / 表格 / 思维导图大纲）
    - Big-Bang 模式：用户自定义组合指令，一并发起翻译+总结+分析

*   **语音朗读（新增，借鉴 nextai-translator TTS）**：
    - 集成 EdgeTTS，支持 30+ 语言语音朗读
    - 选中文本右键 → 朗读；或侧边栏内模型输出一键朗读
    - 语言-语音自动映射（`langCode2TTSLang` 映射表）

### 模块 4：跨端输出与灾备同步 (Export & Backup)

*   **Obsidian URI 直写**：通过 `obsidian://new?vault=[库名]&file=[标题]&content=[内容]` 直接唤起本地 Obsidian 建笔记。借鉴 obsidian-clipper 的 `saveToObsidian` 机制，包括自动生成 YAML Frontmatter（`generateFrontmatter`）及 Properties 元数据字段。

*   **多种保存行为（新增，借鉴 obsidian-clipper Save Behaviors）**：
    - **直接写入 Obsidian**：通过 URI Scheme 或 Obsidian Local REST API
    - **保存为本地文件**：通过浏览器下载 API，支持 `.md` / `.html` / `.txt` 格式
    - **复制到剪贴板**：一键复制 Markdown 渲染结果或原始文本
    - 用户可在设置中配置默认保存行为，每次操作时也可临时切换

*   **Remotely Save (WebDAV/S3)**：利用 `webdav` npm 库，通过 REST API 将 Markdown `PUT` 到云端。
*   **双轨资产备份（防误删）**：
    *   *手动导出*：通过 `jszip` 在 Web Worker 中打包万条 Dexie 数据为 `.zip` 下载。
    *   *自动备份*：利用 `chrome.alarms` 定期在夜间将全量 JSON 覆盖上传至 WebDAV。

*   **浏览器间设置同步（新增，借鉴 obsidian-clipper）**：利用 `chrome.storage.sync` 将模板、Provider 配置、快捷键设置等同步到同一账号的其他浏览器。借鉴 obsidian-clipper 的 `lz-string` 压缩方案，解决 `storage.sync` 单条 8KB 限制——将模板 JSON 压缩后分片存储（CHUNK_SIZE=8000），读取时解压拼接还原。

### 模块 5：后台 RSS 自动化流水线

*   **静默增量抓取**：Service Worker 定时拉取 RSS 链接，利用哈希对比去重。
*   **AI 预处理摘要**：调用轻量模型生成 3 句核心摘要。侧边栏展示信息流，扩展图标显示未读数。
*   **智能分类与归档**：借鉴 obsidian-clipper 模板触发规则，对 RSS 内容按站点/Schema.org 类型自动匹配模板，生成统一格式的笔记存入 Obsidian 指定路径。

---

## 三、 技术选型矩阵与轻量库推荐 (Tech Stack)

> **核心诉求**：引入现成轻量库，坚决避免底层重度二次开发，保障工程收敛。

| 技术维度 | 选型方案 | 引入理由与技术优势 |
| :--- | :--- | :--- |
| **基础工程框架** | `WXT` (v0.19.x) | 基于 Vite 构建，完美支持 MV3 规范；对 Popup、Side Panel、后台与内容脚本提供开箱即用的类型安全与 HMR。 |
| **视图层框架** | `Vue 3` (SFC) + TS | 组合式 API 便于实现多模型网格渲染的复用与解耦；TS 强类型大幅降低大文本 Payload 组装出错率。 |
| **样式与 UI 库** | `UnoCSS` + `Reka UI` | UnoCSS 极致的按需编译，零 runtime 开销；Reka UI 提供无样式原语，便于像素级还原冷淡风视觉。 |
| **多 Provider 引擎** | 自研 `IEngine` 接口 + 适配器 | 借鉴 nextai-translator 的 `abstract-openai.ts` 基类 → 各 Provider 子类（`claude.ts` / `gemini.ts` / `deepseek.ts` 等）的架构模式。基类统一处理 SSE 流式解析、重试、超时；子类仅覆盖 `buildHeaders()` / `buildBody()` / `getBaseUrl()` 等差异化方法。 |
| **正文提取与 Markdown 转换** | `defuddle` | 借鉴 obsidian-clipper 验证的首选方案。相较于 `@mozilla/readability` + `turndown` 两步走，`defuddle` 一步完成 DOM 正文提取到 Markdown 转换，代码路径更短、维护成本更低。`createMarkdownContent()` 方法直接输出高质量结构化 Markdown。 |
| **流式解析(核心)** | `eventsource-parser` | 替代不稳定原生解析，彻底解决多字节字符（中文）在网络 Chunks 截断时产生的乱码与格式断裂问题。nextai-translator 生产环境验证。 |
| **增量 JSON 解析** | `best-effort-json-parser` | 流式场景下解析不完整 JSON 响应。nextai-translator 生产环境验证。 |
| **海量数据库** | `Dexie.js` / `idb-keyval` | 规避 5MB 限制，完美承载 **百万 Token 级别 (1M+ Tokens)** 的超长文本与上万条历史记录检索，支持 GB 级存储。借鉴 nextai-translator 的本地 DB 模式（`internal-services/db.ts`）管理历史记录和生词本。 |
| **跨浏览器兼容** | `webextension-polyfill` | 借鉴 obsidian-clipper 的统一浏览器 API 层，一套代码同时打包 Chromium / Firefox / Safari。 |
| **MD 渲染引擎** | `markdown-it` | 性能极高的 Markdown 解析器，配合流式输出可快速将 LLM 文本转为 HTML。 |
| **客户端防御** | `DOMPurify` | 在渲染大段模型输出及 RSS 抓取的外部 HTML 时，强制在内存中净化 DOM，彻底阻断跨站脚本攻击 (XSS)。obsidian-clipper 已验证。 |
| **模板压缩** | `lz-string` | 借鉴 obsidian-clipper 方案，将提示词模板 JSON 压缩至 `UTF16` 编码，突破 `chrome.storage.sync` 单 Key 8KB 上限。 |
| **日期处理** | `dayjs` | 轻量级日期格式化与相对时间展示。obsidian-clipper 和 nextai-translator 共同选择。 |
| **语音合成** | `EdgeTTS` (Web Speech API) | 借鉴 nextai-translator 的 `tts/edge-tts` 模块，通过浏览器原生 Web Speech API 或 Edge TTS 接口实现 30+ 语言朗读。零额外依赖。 |
| **状态跨端同步** | `Pinia` + `PersistedState` | 基于 `chrome.storage.local` 实现 Pinia 序列化器，保障 Popup 与 Side Panel 的状态秒级互通。 |
| **设置同步** | `chrome.storage.sync` + `lz-string` | 借鉴 obsidian-clipper 的 `generalSettings` + `saveSettings` 模式，模板和 Provider 配置跨浏览器同步，大数据量自动分片压缩。 |

---

## 四、 极限长文本与海量数据架构避坑点 (Critical Architecture Notes)

为支撑 **百万 Token 直通** 与 **10,000+ 条** 深长对话记录且保持 UI 丝滑，开发必须遵循以下红线约束：

### 1. 列表渲染内存熔断防御 (Virtual Scrolling)
*   侧边栏的"历史记录列表"必须引入 `vue-virtual-scroller`。无论底层存了多少万条记录，DOM 树强制只渲染视口可见的 ~20 个节点。严禁 `v-for` 全量渲染。

### 2. 数据库读写分离与超长文本懒加载
*   使用 `Dexie.js` 设计**主副表分离**：
    *   **主表 `Conversations`**：仅存元数据（`id`, `title`, `date`, `models`），查询极快。
    *   **副表 `Messages`**：存储携带**几十万至上百万 Token** 的超长对话 JSON。**严禁在列表页查副表，仅当用户点击某条记录进入阅读模式时，才按 ID 懒加载此数据放入内存。**
*   借鉴 obsidian-clipper 的 `getClipHistory` + `addHistoryEntry` 轻量历史记录模式，历史记录列表仅加载摘要信息。

### 3. Web Worker 隔离全文检索
*   搜索框的"全文检索"范围包含上万条长文本。这在主线程执行正则会引发严重假死。
*   必须将检索逻辑放入原生 `Web Worker`，查询完毕后通过 `postMessage` 将匹配到的摘要高亮切片回传 Vue 渲染。

### 4. 百万级文本的高频渲染防抖 (Debounce/Throttle)
*   引入 1M Tokens 模型意味着前端会面临超大体量的字符渲染。
*   **严禁在 SSE 每接收到一个 chunk 时，对庞大的全量历史上下文重新执行 `markdown-it.render()`**。这会导致页面卡死。
*   **避坑方案**：对正在生成的最新文本块，使用"增量字符串追加（Append）"；或利用 `requestAnimationFrame` 设定约 16ms 延迟的节流重绘，确保长篇大论生成时滚动帧率保持 ≥45fps。
*   借鉴 obsidian-clipper 的 `memoizeWithExpiration` 模式：对模板编译等高频调用进行短期缓存（5s 过期 + URL 敏感 Key），避免重复计算。

### 5. 多 Provider 请求调度与容错
*   借鉴 nextai-translator 的 `abortSignal` + 独立重试机制：每个 Provider 的 SSE 连接绑定独立 `AbortController`，用户中止或超时时精准关闭对应连接，不影响其他模型。
*   Provider 请求失败时按状态码分层处理：
    - 401/403 → 引导用户检查 API Key
    - 429 → 展示 Rate Limit 冷却时间（借鉴 obsidian-clipper 的 `RATE_LIMIT_RESET_TIME = 60000ms` 机制）
    - 5xx → 自动重试 1 次，仍失败则展示错误信息
*   借鉴 nextai-translator 的 `onStatusCode` 回调，实时监控 HTTP 状态码以支持调试和日志。
*   **SSE 断线自动重连（借鉴 Cherry Studio WebSocket 自动重连机制）**：SSE 连接意外断开时，采用指数退避策略（初始 1s，最大 30s，上限 5 次）自动重连；重连时携带上次接收的最后 `event_id`，服务端可从断点续传。用户无感知切换，侧边栏仅显示轻量重连指示器。
*   **多 Provider 故障转移（借鉴 Read Frog）**：用户可配置主备模型链（如主模型 OpenAI GPT-4o → 备用 Anthropic Claude → 兜底 DeepSeek）。主模型请求失败或超时（可配置超时阈值，默认 30s）后，自动按优先级切换到备用模型重试。切换全程对用户透明，仅在最终成功或全部失败时提示所用模型。

### 6. 模板引擎安全与变量解析
*   借鉴 obsidian-clipper 的 AST-based 模板编译器（`template-compiler.ts` → `renderer.ts`）：变量解析走编译期静态分析而非运行时 `eval()`，杜绝代码注入风险。
*   变量引用使用 `{{variableName}}` 或 `{{variableName\|filter}}` 语法，Filter 链严格控制白名单，不得执行任意 JavaScript。
*   模板的 Interpreter Context 支持通过 `{{selectorHtml:#main}}` 变量限制 LLM 上下文范围，减少 Token 消耗。

### 7. 包体积与平台分发策略
*   借鉴 nextai-translator 的多 `vite.config.*.ts` 方案：
    - `vite.config.chromium.ts` → Chrome / Edge / Brave / Arc
    - `vite.config.firefox.ts` → Firefox
    - 未来可扩展 `vite.config.safari.ts`（借鉴 obsidian-clipper 的 Xcode 项目结构）
*   用户脚本（Userscript）模式：通过 `vite.config.userscript.ts` 打包为单文件 `.user.js`，降低安装门槛（nextai-translator 已有此模式）。
*   桌面端（未来可选）：通过 `vite.config.tauri.ts` + Tauri 打包为跨平台桌面应用，利用系统级能力（全局快捷键、OCR 截图翻译、AppleScript 文本选中提取）。

### 8. 智能缓存策略（借鉴 Cherry Studio 多级缓存）
为减少重复 API 调用、提升响应速度并降低 Token 消耗，系统内置三级缓存：
*   **内存缓存（L1）**：存储频繁访问的短期数据（当前页面提取结果、最近 5 次 API 响应），使用 LRU 策略自动淘汰。页面关闭即释放，适合一次浏览会话内的快速复用。
*   **本地持久化缓存（L2）**：通过 IndexedDB 存储相同 URL 的页面提取结果和结构化元数据。用户再次打开同一页面时直接命中缓存，避免重复执行 `defuddle` 提取（节省 2~8s）。缓存带 TTL（默认 24h），过期自动刷新。
*   **API 响应缓存（L3）**：相同 Query + 相同页面上下文（以 URL + content hash 为 Key）的 API 请求直接返回缓存结果，不发起网络调用。适用于频繁切换模型对比同一问题的场景。缓存命中时在底栏标注 `⚡ Cached`。
*（内容由AI生成，仅供参考）*
