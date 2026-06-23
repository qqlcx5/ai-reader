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

---

## 2. 核心功能需求

### 2.1 智能正文提取（Readability Engine）

> 设计目标：从任意网页中高保真提取结构化正文，输出干净的 Markdown，为下游 AI 分析提供高质量上下文。

#### 2.1.1 三级降级提取算法

| 优先级 | 引擎 | 触发条件 | 超时限制 | 输出格式 |
|:---:|:---|:---|:---:|:---|
| 1 | `defuddle`（异步远程） | Readability 返回空或置信度低 | 8 秒 | Markdown（内置 `createMarkdownContent`） |
| 2 | `@mozilla/readability` | 默认首选，纯本地 | — | Markdown（经 `turndown` 转换） |
| 3 | `document.body.innerText` 清洗 | 前两步均失败 | — | 纯文本 |

- **第一级**：Defuddle 服务端接口，采用 `extractPageContent` + `initializePageContent` 双阶段提取（先获取基础元数据再异步加载正文），8 秒超时后降级。
- **第二级**：Mozilla Readability 经长期生产验证，纯本地运算，零网络请求，毫秒级剥离广告与噪音节点。原型验证：本地提取纯正文成功耗时仅 38ms，节点纯化比例 94.6%。
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
