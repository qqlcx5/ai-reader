# 产品需求文档（PRD）：ReadChat Clipper

> **文档版本**：v1.3 — 参考实现补充版
> **产品定位**：一款主打“一页一会话（Page-Isolated Chat）”的浏览器扩展
> **视觉规范**：以 `design.html` 为准，`design-tokens.md` 为速查索引
> **参考实现**：`obsidian-clipper`（模板/变量/高亮/阅读模式）、`nextai-translator`（多引擎/流式/桌面扩展架构）

---

## 1. 文档说明

### 1.1 目的

本文档用于统一 ReadChat Clipper 的产品需求边界，为设计、研发、测试、运营提供唯一依据。所有功能描述、非功能性指标、验收标准、边界假设均以本版本为准。

### 1.2 读者对象

- 产品经理 / 设计师
- 前端与扩展开发工程师
- 测试工程师
- 运维与数据安全相关人员

### 1.3 术语表

| 术语 | 说明 |
|:---|:---|
| **Page-Isolated Chat** | 以网页为单位隔离对话上下文，每个 URL 拥有独立会话 |
| **Readability Engine** | 智能正文提取模块，含多级降级策略 |
| **Arena Mode** | 多模型并发对比模式，支持 1~4 个模型同时输出 |
| **AI Chain / 工作流** | 将多个模型按串行或角色并行的方式编排为流水线 |
| **Library / 阅读库** | 本地历史记录与快照管理中心 |
| **Provider** | 大模型服务提供方（如 OpenAI、Anthropic、Google、DeepSeek 等） |
| **Interpreter** | 调用 LLM 对页面内容进行自然语言提取/转换的变量解释器 |
| **Template Trigger** | 基于 URL 或 Schema.org 数据自动匹配提示词模板的规则 |
| **Filter** | 对变量值进行后处理的函数链（如 `\|truncate:100`） |
| **TTFT** | Time To First Token，首字延迟 |
| **净网址** | 去除查询参数与 Hash 后的 canonical URL |
| **Shadow DOM Flatten** | 将页面中的 Shadow DOM 树展开为常规 DOM 以便提取 |

---

## 2. 产品概述

### 2.1 产品定位

ReadChat Clipper 是一款运行于浏览器侧边栏的 AI 阅读辅助扩展。它精准提取当前网页正文作为背景知识，让用户通过调用大模型（LLM）与当前网页进行深度对话。所有提取内容和对话记录均与特定网页绑定，持久化保存在本地，并支持跨设备 / 跨浏览器的全量备份与恢复。

### 2.2 核心价值

| 维度 | 描述 |
|:---|:---|
| **专注阅读与思考** | 借鉴 Obsidian Clipper 的提取算法，去广告、去干扰，只保留核心正文 |
| **上下文绝对隔离** | 页面 A 的对话不会污染页面 B，符合人类基于特定文章批注和探讨的认知习惯 |
| **数据资产私有化** | 对话不再阅后即焚，保留文章快照与思想碰撞，并支持完全导出 |
| **零后端依赖** | API Key 安全存储于本地，请求直连各厂商端点，不经过第三方服务器 |

### 2.3 竞品对比定位

| 产品 | 优势 | 我们差异化 |
|:---|:---|:---|
| Sider AI | 多模型 + 页面感知 | 页面隔离对话 + 本地资产管理 + 全量备份 |
| ChatGPTBox | 浮动工具栏 + 多站适配 | 正文快照 + 会话持久化 + 多模型并发对比 |
| Page Assist | 本地模型侧边栏 | 支持云端 API + 工作流编排 + RSS 简报 |
| Obsidian Clipper | 网页剪藏 + 元数据 | 加入 AI 对话层 + 多模型 Arena 模式 |

---

## 3. 目标用户与使用场景

### 3.1 目标用户

1. **深度阅读者**：需要长期保存、批注、反复查阅网页文章。
2. **研究者 / 分析师**：需要对大量网页进行摘要、对比、批判性分析。
3. **多模型尝鲜用户**：希望一次提问看到多个模型输出差异。
4. **数据隐私敏感用户**：不希望对话内容经过第三方服务器。

### 3.2 典型使用场景

| 场景 | 用户目标 | 关键功能 |
|:---|:---|:---|
| 阅读长文 | 快速理解核心观点 | 智能提取 + 一键摘要 + 关键概念解释 |
| 跨语言阅读 | 阅读外文技术博客 | 全文翻译 + 术语解释 + 多模型翻译对比 |
| 资料整理 | 保存文章并做笔记 | 本地快照 + 对话历史 + Obsidian 导出 |
| 论文批判 | 评估文章逻辑 | 红队批判 + 圆桌讨论 + 多模型对比 |
| 多端迁移 | 换电脑后恢复数据 | 全量导出 / WebDAV 同步 |
| 精读批注 | 在原文上做重点标记 | 高亮 + 阅读模式 + 高亮导出 |
| 信息结构化 | 从不同网站提取统一字段 | 模板变量 + Selector + Schema.org + Interpreter |

---

## 4. 功能性需求

### 4.1 智能正文提取（Readability Engine）

#### 4.1.1 三级降级提取算法

| 优先级 | 引擎 | 触发条件 | 超时限制 | 输出格式 |
|:---:|:---|:---|:---:|:---|
| 1 | `defuddle`（异步远程） | Readability 返回空或置信度低 | 8 秒 | Markdown（内置 `createMarkdownContent`） |
| 2 | `@mozilla/readability` | 默认首选，纯本地 | — | Markdown（经 `turndown` 转换） |
| 3 | `document.body.innerText` 清洗 | 前两步均失败 | — | 纯文本 |

- **第一级**：Defuddle 服务端接口采用 `extractPageContent` + `initializePageContent` 双阶段提取，先获取基础元数据，再异步加载正文；8 秒超时后降级。
- **第二级**：Mozilla Readability 经长期生产验证，纯本地运算，零网络请求，毫秒级剥离广告与噪音节点。原型验证：本地提取纯正文成功耗时仅 38ms，节点纯化比例 94.6%。
- **第三级**：强制清洗 DOM 树中的 `<script>` 与 `<style>` 节点，直取 `document.body.innerText` 作为兜底。

#### 4.1.2 无限制上下文直通（No Truncation）

- 系统**不得**在前端对提取内容设置硬性字符 / Token 上限或做截断丢弃。
- 充分利用 Gemini 1M+、Claude 200k+ 等超长上下文能力。
- 原型验证：已成功传递 1,045,200 字（约 1.04M 字符）超长正文直灌 API。
- 提取状态栏展示 `No Truncation` 绿色 badge，明示当前无截断状态。

#### 4.1.3 结构化元数据提取

提取页面时同步采集以下元数据，并作为系统变量注入 Prompt 上下文：

| 类别 | 变量 | 说明 |
|:---|:---|:---|
| 预置 | `title` / `author` / `description` / `published` | 页面基础信息 |
| 预置 | `site` / `domain` / `favicon` / `image` | 站点信息与社交图 |
| 预置 | `words` | 字数统计 |
| Meta | `og:title` / `og:description` / `og:image` | Open Graph 数据 |
| Schema.org | `@Article` / `@Recipe` / `@Product` | JSON-LD / Microdata 结构化数据 |

#### 4.1.4 上下文静默锚定机制

- 侧边栏顶部常驻**当前上下文状态栏**，显示已锚定页面的 favicon、标题与字数。
- 切换浏览器 Tab 时，系统**静默保持**上一次提取的网页作为对话上下文，不打断原有对话流。
- 提供【⟳ 刷新提取当前 Tab】主按钮，供用户主动更新上下文。
- 切换 Tab 时弹出“上下文静默锚定”轻量提示，告知用户对话上下文仍锁定在原页面。

#### 4.1.5 浮动工具栏与右键菜单

- **浮动工具栏**：页面划选文本后自动弹出，提供解释 / 总结 / 翻译 / 提问四个快捷操作，定位在选区附近并自动避开边缘。
- **右键菜单集成**：通过 `chrome.contextMenus` API 注入 AI 操作项（解释 / 总结 / 翻译 / 朗读 / 搜索），仅在有选区时显示。
- **Shadow DOM 隔离**：浮动工具栏和右键注入 UI 均使用 Shadow DOM 承载，配合 CSS Modules 命名隔离，彻底避免与宿主页面样式冲突。

#### 4.1.6 Shadow DOM 与动态内容处理

- 提取前调用 `flattenShadowDom(document)`，将页面中的 Shadow DOM 展开为常规 DOM 节点后再参与解析；设置 3 秒超时兜底，防止异常 Shadow DOM 阻塞。
- 对 SPA / 动态加载页面，支持在 `window.load` 或用户触发“刷新提取”后重新执行提取。
- 异步变量（如 Prompt 变量、Transcript 变量）通过 `parseAsync` 获取，并设置 8 秒解析超时，超时后回退到同步 `parse()`。

#### 4.1.7 页面资源 URL 绝对化

- 提取后清洗 DOM：移除 `<script>`、`<style>` 节点及所有元素的 `style` 属性。
- 将所有相对 `src` / `href` / `srcset` 转换为绝对 URL，便于导出 Markdown 和离线快照时图片/链接可用。
- 转换规则以 `document.baseURI` 为基准，对 `data:`、绝对 URL、锚点 `#` 及 `//` 协议相对 URL 保持原样。

#### 4.1.8 划选内容提取

- 当用户划选文本时，记录选区对应的 HTML 片段 `selectedHtml`，并转换为 Markdown 格式作为 `{{selection}}` 变量。
- 高亮数据（Highlighter）作为页面变量的一部分随 Page 实体一起保存，支持后续导出与恢复。

---

### 4.2 多模型管理与安全配置（Local Provider）

#### 4.2.1 安全存储方案

| 存储位置 | 用途 | 特性 |
|:---|:---|:---|
| `chrome.storage.local` | API Key 持久化 | 跨会话保留，仅本地可读 |
| `chrome.storage.session` | 临时会话密钥 | 浏览器关闭即清除 |
| `chrome.storage.sync` | Provider 配置同步 | 跨浏览器同步（经 `lz-string` 压缩分片） |

- API Key 在前端直接调用各厂商端点（如 `api.openai.com`），**绝不经过第三方服务器**。
- 每个 Provider 支持独立配置自定义 Base URL（代理 URL），全局代理开关可一键路由所有请求。

#### 4.2.2 Provider 配置结构

每个 Provider 配置参考 `providers.json` 标准结构：

```json
{
  "id": "openai",
  "name": "OpenAI",
  "apiKeyUrl": "https://platform.openai.com/api-keys",
  "apiKeyRequired": true,
  "modelsList": "https://platform.openai.com/docs/models",
  "baseUrl": "https://api.openai.com/v1/chat/completions",
  "popularModels": [
    { "id": "gpt-4o", "name": "GPT-4o" },
    { "id": "gpt-4o-mini", "name": "GPT-4o Mini" }
  ]
}
```

- 支持预设 Provider 与完全自定义 Provider。
- 自定义 Provider 可配置：id、名称、API Key、Base URL、模型列表地址、默认模型、温度、最大 Token、是否支持自定义模型。
- 支持一个 Provider 配置多个 API Key（逗号分隔），发送请求时随机选择其一，实现简单的负载均衡与失败重试。

#### 4.2.3 模型适配器设计（IEngine）

- 自研 `IEngine` / `AbstractEngine` 接口，统一处理 SSE、重试、超时、错误码转换。
- 每个 Provider 实现子类：
  - `OpenAIEngine`：支持标准 Chat Completions 与 OpenAI Responses API 自动切换。
  - `AnthropicEngine`：支持 Messages API 与 Anthropic 专用流式格式。
  - `GeminiEngine`：支持 Google Gemini 的 `generativelanguage` 端点。
  - `DeepSeekEngine` / `KimiEngine` / `CohereEngine`：OpenAI 兼容协议适配。
  - `OllamaEngine`：本地模型，无需 API Key，默认 `http://127.0.0.1:11434/api/chat`。
- 子类仅覆盖：`getAPIModel()`、`getAPIKey()`、`getAPIURL()`、`getAPIURLPath()`、`getHeaders()`、`getBaseRequestBody()`、模型列表拉取。

#### 4.2.4 模型特定参数与 API 路由

- 基类根据模型前缀自动选择请求参数：
  - GPT-3.5/4 系列：`temperature=0`、`top_p=1`、`frequency/presence_penalty=1`、`stream=true`。
  - o 系列 / GPT-5 Pro：`reasoning_effort='low'`、`stream=true`，不支持 `temperature`。
  - GPT-5 chat/code/instant：`stream=true`，无 `reasoning_effort`。
  - 本地 / 宽松 Provider：允许用户通过 `thinkingEnabled` 开关控制 `reasoning_effort`。
- OpenAI 官方端点且模型推荐使用 Responses API 时，自动切换至 `/responses` 路径，并转换字段：`messages` → `input`、`system` → `instructions`、`max_tokens` → `max_output_tokens`。
- 支持 `modelOverride` 参数：单次请求可强制覆盖默认模型，便于 Arena 模式与重试切换模型。

#### 4.2.5 模型列表动态拉取

- 对于有 `/v1/models` 端点的 Provider，使用 API Key 拉取可用模型列表。
- 允许用户关闭模型 API 拉取（`noModelsAPISupport`），此时使用预设静态模型列表。
- 拉取结果过滤：OpenAI 官方端点仅保留 `id` 包含 `gpt` 的模型；其他端点排除 `text-`、`dall-`、`tts-`、`whisper-`、`davinci`、`babbage` 等非聊天模型。
- 自定义模型支持：用户可输入任意模型 ID，并标记为“自定义模型”。

---

### 4.3 独立页面对话系统（Page-Isolated Chat）

#### 4.3.1 URL 绑定机制

- 以网页 URL（去参数后的净网址经 SHA-256 哈希）作为唯一主键 `id`。
- 打开同一 URL 时自动加载该页面的历史对话记录；不同页面的对话彼此完全隔离。
- 同一页面不同 Tab 之间共享同一上下文。

#### 4.3.2 自动 Context 注入

- 提取到的 Markdown 正文作为 `system` 角色消息或隐式 Context 注入大模型，用户无需手动粘贴文章。
- Context 注入顺序：
  ```
  [系统角色指令] → [页面元数据摘要] → [正文 Markdown 全文] → [历史对话记录] → [用户新消息]
  ```

#### 4.3.3 多模型并发对比（Arena Mode）

- 输入框上方提供**并发路由选择器**，可同时勾选 1~4 个模型并发执行。
- 侧边栏分栏（1 / 2 / 3 / 4 栏网格）同时渲染不同模型的生成过程，互不阻塞。
- 每个模型卡片底部显示以下性能指标：

| 指标 | 说明 | 来源 |
|:---|:---|:---|
| 耗时（ms） | 从发送到接收完成的墙钟时间 | `performance.now()` 差值 |
| TTFT | 首字延迟 | 首 chunk 时间戳 |
| Tokens/s | 每秒生成 Token 数 | 生成量 / 耗时 |
| 价格估算 | API 调用费用估算 | 基于 Provider 定价表 |

#### 4.3.4 流式输出与渲染

- 多模型同时 SSE 流式打字机输出，各模型独立建立 SSE 连接，支持独立重试 / 中止。
- 使用 `eventsource-parser` 流式解析，替代原生 EventSource，彻底解决中文多字节字符在网络 Chunks 截断时产生的乱码问题。
- SSE 断线时采用指数退避策略自动重连（初始 1s，最大 30s，上限 5 次），重连携带最后 `event_id`，用户无感知。
- 严禁在每接收一个 SSE chunk 时对全量历史上下文重新执行 `markdown-it.render()`；应使用增量字符串追加或 `requestAnimationFrame` 约 16ms 节流重绘，保持生成时帧率 ≥ 45fps。

#### 4.3.5 对话管理

- **重试（Regenerate）**：重新发送最后一条用户消息，支持切换到不同模型重试。
- **编辑用户消息**：双击用户气泡进入编辑模式，保存后自动截断后续消息并重新生成。
- **删除单条消息**：hover 消息气泡时出现删除操作，删除后从 IndexedDB 持久化更新。
- **单分支追问**：点击模型卡片底部“以此继续”，分离出针对该模型的单线对话流。

#### 4.3.6 快捷指令（Prompt 模板）

预设一键操作按钮，排布于输入框下方：

| 指令 | Prompt 摘要 |
|:---|:---|
| 📋 总结摘要 | 用三段话概括文章核心论点 |
| 💡 解释关键概念 | 提取并解释文中所有专业术语 |
| 🎯 提取核心观点 | 提取文章中作者最想表达的 3~5 个核心观点 |
| 🌐 翻译成中文 | 将全文翻译为地道简体中文并保留原有排版 |
| 🔬 红队批判 | 以批判性思维指出文章的逻辑漏洞与不足 |
| 🗺️ 脉络大纲 | 生成完整的章节级结构大纲 |

---

### 4.4 AI 工作流（模型链 / AI Chain）

#### 4.4.1 串行接力（Relay Chain）

配置 2 个及以上模型串行执行：先跑模型 A，A 完成后自动触发模型 B，B 收到 A 的完整输出作为额外上下文。

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

#### 4.4.2 多角色圆桌讨论（Roundtable）

- 用户设定多个角色（🟥 红方挑刺 / 🟩 蓝方辩护 / 🟧 产品落地）。
- 系统将不同 Role Prompt 注入各模型的 System Payload 并发执行，实现跨模型观点交锋。
- 三角色网格布局，一键启动圆桌。

#### 4.4.3 提示词模板系统

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

#### 4.4.4 完整模板变量系统（参考 Obsidian Clipper）

模板中可使用的变量类型：

| 类型 | 语法示例 | 说明 |
|:---|:---|:---|
| **Preset** | `{{content}}`、`{{title}}`、`{{author}}`、`{{selection}}`、`{{highlights}}`、`{{words}}` | 自动从页面生成 |
| **Prompt** | `{{"a summary of the page"}}` | 调用 Interpreter 由 LLM 生成 |
| **Meta** | `{{meta:name:description}}`、`{{meta:property:og:title}}` | 从 meta 标签提取 |
| **Selector** | `{{selector:h1}}`、`{{selector:.author}}`、`{{selector:img.hero?src}}` | 从 CSS Selector 提取文本或属性 |
| **SelectorHtml** | `{{selectorHtml:#main}}` | 提取元素 HTML，可配合 `markdown` Filter 转换 |
| **Schema.org** | `{{schema:@Article.headline}}`、`{{schema:author.name}}` | 从 JSON-LD / Microdata 提取 |

- 多个 Selector 匹配时返回数组，可配合 `join` / `map` / `slice` 等 Filter 处理。
- Prompt 变量默认使用整页 HTML 作为上下文，但可在模板中指定更精确的 Selector 上下文以减少 Token 消耗。

#### 4.4.5 模板触发器（Template Trigger）

- 支持为每个模板设置多个触发规则，按模板列表顺序匹配第一个命中的模板。
- 触发规则类型：
  - **URL 前缀**：`https://obsidian.md` 匹配所有以该字符串开头的 URL。
  - **正则表达式**：`/https:\/\/www\.imdb\.com\/title\/tt\d+/` 用于精确匹配页面模式。
  - **Schema.org 匹配**：`schema:@Recipe` 匹配页面类型；`schema:@Recipe.name=Cookie` 匹配字段值。
- 支持模板拖拽排序，调整匹配优先级。

#### 4.4.6 模板逻辑（Template Logic）

支持类 Twig/Liquid 的模板逻辑，用于条件渲染、循环、赋值与 Fallback：

| 能力 | 语法示例 | 说明 |
|:---|:---|:---|
| 条件 | `{% if author %}Author: {{author}}{% endif %}` |  truthy/falsy 判断 |
| 比较 | `{% if price >= 100 %}` / `{% if title contains "Review" %}` | 支持 `==`、`!=`、大小于、`contains` |
| 逻辑组合 | `{% if author and published %}` | 支持 `and`/`&&`、`or`/`\|\|`、`not`/`!` |
| 赋值 | `{% set slug = title\|lower\|replace:" ":"-" %}` | 创建中间变量 |
| 循环 | `{% for item in selector:.comment %}{{item}}{% endfor %}` | 遍历数组 |
| Fallback | `{{title ?? "Untitled"}}` | 变量为空时提供默认值 |

- 模板逻辑在变量求值之后、Prompt 变量执行之前处理，因此可用逻辑动态构造 Prompt，但 Prompt 结果不能参与逻辑判断。

#### 4.4.7 Filters 处理流水线

模板变量支持链式 Filter 后处理：

| 类别 | 示例 | 说明 |
|:---|:---|:---|
| 日期 | `{{date\|date:"YYYY-MM-DD"}}` | 日期格式化 / 转换 |
| 文本 | `{{title\|lower\|replace:" ":"-"\|safe_name}}` | 大小写、替换、安全文件名 |
| Markdown | `{{contentHtml\|markdown}}` / `{{content\|strip_md}}` | HTML ↔ Markdown 转换、清除 Markdown 格式 |
| HTML | `{{fullHtml\|remove_html:"img,.ad"}}` | 移除指定 HTML 元素/标签/属性 |
| 数组 | `{{tags\|join:", "}}` / `{{items\|map:item => item.name}}` | 数组连接、映射、切片、去重 |
| 数字 | `{{price\|round:2}}` / `{{count\|calc:"+10"}}` | 数值处理 |
| 模板 | `{{items\|template:"- ${name}\n"}}` | 对数组/对象应用字符串模板 |

- Filter 按声明顺序依次应用，可任意组合。
- 所有 Filter 实现必须在 Web Worker 或主线程中安全执行，禁止 `eval()`。

#### 4.4.8 Interpreter（AI 解释器）

- Interpreter 是模板系统与 LLM 的桥接层：当模板中包含 `{{"..."}}` 形式的 Prompt 变量时，系统将该 Prompt 与页面上下文一并发送给模型，返回结果替换变量。
- 支持在模板级配置 Interpreter 上下文，例如使用 `{{selectorHtml:#main}}` 限定只解读正文区域，降低 Token 与费用。
- 支持用户选择运行 Interpreter 的模型（建议使用小模型，如 Claude Haiku / Gemini Flash / GPT-4o Mini）。
- Interpreter 输出可继续通过 Filter 后处理，例如：`{{"a summary of the page"\|blockquote}}`。
- 隐私提示：Interpreter 请求直连用户配置的 Provider，不经过扩展后端。

---

### 4.5 数据历史与资产管理（Library）

#### 4.5.1 历史记录面板

- 独立的“阅读库”标签页（类似书签管理器），按时间倒序或域名分类展示所有抓取并对话过的页面。
- 列表使用 `vue-virtual-scroller` 虚拟滚动，无论底层存了多少万条记录，DOM 树强制只渲染视口可见的约 20 个节点，严禁 `v-for` 全量渲染。
- 每个列表项展示：favicon、页面标题、抓取时间、对话消息数量、字数、高亮数量。

#### 4.5.2 快照查看

- 点击历史记录进入阅读模式，分 Tab 展示：
  - **Tab 1 - 文章快照**：当时提取的正文 Markdown 全文（即使原网页已失效被删除，本地数据依然可用）。
  - **Tab 2 - 对话历史**：完整的历史对话记录，支持重新发送消息继续对话。
  - **Tab 3 - 高亮批注**：当时用户在页面上添加的高亮片段与批注。
- 列表仅加载主表元数据（<5ms），点击后才懒加载副表完整对话 JSON（含百万 Token 级别长文本），严禁在列表页查副表。

#### 4.5.3 全文检索

- 支持全文检索（搜索文章标题、正文或对话记录中的关键词）。
- 检索逻辑放入原生 `Web Worker`，查询完毕后通过 `postMessage` 将匹配到的摘要高亮切片回传 Vue 渲染，避免主线程假死。
- 搜索结果高亮：`#fff299` 背景色 + `#5c4a00` 文字。

---

### 4.6 跨设备备份与全量恢复

#### 4.6.1 全量导出（本地备份）

- 通过 `jszip` 在 Web Worker 中打包 Dexie 全量数据为 `.zip` 下载，Worker 线程展示压缩进度条。
- 备份包含：所有网页元数据、正文快照（Markdown 格式）、完整对话记录（JSON）、高亮批注、Prompt 模板。
- 导出的 JSON 格式标准（见第 8 节），可被外部脚本解析转换。

#### 4.6.2 全量导入与合并

- 支持在新浏览器 / 新电脑上导入备份文件。
- 支持两种合并策略：
  - **覆盖合并**：以导入数据为准，覆盖本地同 URL 的记录。
  - **跳过重复项**：保留本地数据，仅导入本地不存在的记录。

#### 4.6.3 WebDAV / S3 双向同步

- 支持用户配置坚果云、Nextcloud 或自建 S3 服务。
- **导出（上传）**：利用 `webdav` npm 库，通过 REST API 将 Markdown 增量 `PUT` 到云端指定文件夹。
- **导入（下载）**：从云端拉取配置、Prompt 模板、历史快照。
- 同步策略支持手动触发和 `chrome.alarms` 定时自动同步（默认每 7 天凌晨 3 点静默灾备）。

#### 4.6.4 Obsidian 直写 / 本地文件导出

- **直接写入 Obsidian**：通过 `obsidian://new?vault=[库名]&file=[标题]&content=[内容]` URI Scheme。
- **保存为本地文件**：通过浏览器下载 API，支持 `.md` / `.html` / `.txt` 格式。
- **复制到剪贴板**：一键复制 Markdown 渲染结果或原始文本。
- 自动生成 YAML Frontmatter（含 `title`、`source_length`、`engine`、`truncation`、`models_applied` 字段）。

#### 4.6.5 浏览器间设置同步

- 利用 `chrome.storage.sync` + `lz-string` 压缩分片（CHUNK_SIZE=8000），将模板、Provider 配置、快捷键设置同步到同一账号的其他浏览器，突破 `storage.sync` 单 Key 8KB 限制。

---

### 4.7 阅读增强（高亮与阅读模式）

#### 4.7.1 网页高亮（Highlighter）

- 支持在网页正文上划选文本并添加高亮，高亮数据（文本、位置、时间戳、批注）与 Page 绑定并本地持久化。
- 高亮覆盖层使用独立 CSS 文件注入，避免与宿主页面样式冲突。
- 高亮支持：
  - 划选高亮：划选文本后通过浮动工具栏或右键菜单添加高亮。
  - 元素高亮：针对图片、视频、音频等元素添加高亮标记。
  - 高亮列表：在侧边栏展示当前页面所有高亮，点击可跳转定位。
  - 高亮导出：高亮内容可作为 `{{highlights}}` 变量参与模板和对话。
- 页面加载时自动恢复高亮；切换 Reader Mode 时高亮位置自动重新定位。

#### 4.7.2 阅读模式（Reader Mode）

- 提供沉浸式阅读模式，将当前页面重新渲染为简洁、可聚焦的阅读视图。
- 阅读模式需保留：标题、正文、图片、代码块、表格、引用。
- 阅读模式下仍可触发高亮、划选翻译、AI 对话。
- 阅读模式与侧边栏对话共存，上下文仍基于当前页面。

---

## 5. 非功能性需求

### 5.1 性能需求

| 指标 | 要求 | 说明 |
|:---|:---|:---|
| 本地正文提取耗时 | ≤ 100ms（P95） | 以 Readability 本地提取为主路径 |
| 侧边栏打开冷启动 | ≤ 500ms | 从点击图标到可输入 |
| 历史记录列表加载 | ≤ 5ms（万条级） | 仅加载主表元数据 |
| 流式渲染帧率 | ≥ 45fps | 生成过程中不卡顿 |
| 单条百万字符上下文 | 可成功注入 API | 不前端截断 |
| 索引数据库容量 | 支持 GB 级存储 | 使用 Dexie.js + IndexedDB |
| 模型列表拉取 | ≤ 3s | 超时后回退静态列表 |

### 5.2 安全与隐私需求

- API Key 仅存储于本地 `chrome.storage.local`，不传输到任何第三方服务器。
- 所有网络请求直连官方端点或用户自定义 Base URL。
- 渲染模型输出与外部 HTML 时必须经过 `DOMPurify` 净化，防止 XSS。
- 变量解析、模板逻辑、Filter 执行均禁止 `eval()` / `new Function()`，必须采用静态模板编译或安全沙箱执行。
- 用户划选文本与页面内容仅在本地处理，不上传云端（除非用户主动配置 WebDAV/S3 或触发 Interpreter）。
- 阅读模式和高亮注入脚本不得污染宿主页面全局变量。

### 5.3 可靠性与兼容性需求

- 扩展需支持 Chromium（Chrome / Edge）、Firefox、Safari 三端打包，核心代码一套。
- 正文提取在 99% 常见网页上成功，失败时兜底至 `innerText` 纯文本。
- SSE 断线后自动重连，用户无感知；重连上限 5 次，失败后明确提示。
- 离线状态下：可查看历史快照与对话，但 LLM 调用不可用。
- 支持扩展热更新后内容脚本的多代共存：通过 `window.obsidianClipperGeneration` 计数器，旧代内容脚本检测到新代后自动 yield，避免僵尸脚本响应。

### 5.4 可访问性与国际化需求

- 侧边栏支持键盘导航与快捷键（可自定义）。
- 支持中文 / 英文界面切换（后续可扩展更多语言）。
- 高对比度模式与字体大小调整（可后续迭代）。

---

## 6. 数据与存储需求

### 6.1 数据实体

| 实体 | 字段 | 说明 |
|:---|:---|:---|
| **Page** | `id`, `url`, `title`, `author`, `description`, `published`, `site`, `domain`, `favicon`, `image`, `words`, `markdown`, `extractedAt`, `engine`, `selectedHtml`, `schemaOrgData`, `metaTags`, `fullHtml`, `highlights` | 网页快照主表 |
| **Conversation** | `pageId`, `messages[]`, `model`, `createdAt`, `updatedAt`, `branches[]` | 页面对话记录，支持分支 |
| **Provider** | `id`, `name`, `apiKeyUrl`, `apiKeyRequired`, `modelsList`, `baseUrl`, `popularModels`, `apiKeys`, `defaultModel`, `temperature`, `maxTokens`, `customModelEnabled`, `enabled` | 模型提供方配置 |
| **PromptTemplate** | `id`, `name`, `content`, `variables`, `triggers`, `interpreterContext`, `order` | 提示词模板 |
| **Workflow** | `id`, `name`, `nodes[]`, `edges[]` | AI 工作流编排 |
| **Settings** | `theme`, `language`, `shortcuts`, `syncEnabled`, `syncEndpoint`, `thinkingEnabled`, `noModelsAPISupport` | 用户设置 |
| **Highlight** | `pageId`, `highlights[]`（text, selector, range, note, createdAt） | 高亮批注 |

### 6.2 存储策略

- 使用 Dexie.js 封装 IndexedDB，避免 `chrome.storage.local` 5MB 限制。
- `chrome.storage.local` 仅用于存储加密 API Key、小型配置与临时状态。
- `chrome.storage.sync` 存储压缩后的设置分片，Provider 配置与模板跨浏览器同步。
- 图片 / 大资源不直接存储，仅保存 URL 或 favicon Data URL（大小限制 64KB）。

---

## 7. 界面与交互需求

### 7.1 主要界面模块

| 模块 | 位置 | 说明 |
|:---|:---|:---|
| 侧边栏（Side Panel） | 浏览器右侧边栏 | 主交互界面，含聊天、提取状态、输入框、快捷指令 |
| 弹出面板（Popup） | 工具栏图标点击 | 快速入口、状态概览、最近历史 |
| 阅读库（Library） | 独立标签页 | 历史记录、快照、检索、导入导出 |
| 设置页（Settings） | 独立标签页 | Provider、模板、工作流、同步、快捷键 |
| 浮动工具栏 | 网页内选区附近 | 解释 / 总结 / 翻译 / 提问 / 高亮 |
| 右键菜单 | 浏览器原生右键 | 解释 / 总结 / 翻译 / 朗读 / 搜索 / 高亮 |
| 阅读模式浮层 | 网页内 | 沉浸式阅读视图 |

### 7.2 交互原则

- 默认采用“冷淡风”视觉，以 `design.html` 为准。
- 侧边栏宽度可拖拽调整，默认 400px，最小 320px，最大 720px。
- 输入框支持 Shift+Enter 换行，Enter 发送。
- 所有耗时操作（提取、发送、导出、同步、Interpreter）必须提供进度或 Loading 状态。
- 错误信息需明确区分：网络错误、API 错误、提取失败、存储不足、模型不支持。

---

## 8. 边界与约束

### 8.1 不在本版本范围内的需求

- 不支持直接 PDF 文件解析（可先通过外部工具转换后导入）。
- 不支持视频 / 音频内容理解（仅支持媒体元素高亮与 OCR 截图翻译，可选）。
- 不支持扩展内直接创建新网页（仅作为阅读增强工具）。
- 不支持多人实时协作（本地优先，单人使用）。
- 不支持扩展商店内自动售卖或订阅支付。
- 桌面端独立应用（Tauri/Electron）作为后续阶段，不纳入浏览器扩展 MVP。

### 8.2 技术约束

- 必须基于 Manifest V3（MV3）开发。
- 必须兼容 Safari 扩展框架（部分 API 需 polyfill）。
- 服务端仅用于可选的 defuddle 提取接口，核心对话功能零后端。
- 所有 npm 依赖体积需控制，打包后扩展总体积 ≤ 10MB（不含 sourcemap）。
- 模板编译和 Filter 执行必须避免 `eval()`，使用 AST 或安全解释器。

---

## 9. 风险与假设

### 9.1 主要风险

| 风险 | 影响 | 缓解措施 |
|:---|:---|:---|
| 长上下文导致 API 费用高 | 用户成本不可控 | 提供价格估算、Arena 模式默认只选 1 个模型、Interpreter 可限定上下文 |
| 大文本 IndexedDB 性能下降 | 历史库卡顿 | 副表懒加载、虚拟滚动、Web Worker 检索 |
| 不同网页结构提取失败 | 正文质量差 | 三级降级、defuddle 远程兜底、innerText 兜底 |
| 浏览器扩展政策变更 | 上架受阻 | 严格遵循 MV3，避免远程代码加载 |
| API Key 本地泄露 | 安全风险 | storage.local 加密、最小权限原则 |
| 多模型并发导致配额消耗快 | 用户成本激增 | 默认单模型、并发数上限 4、每次发送前确认 |
| 模板变量注入 / 过滤不当 | 安全漏洞 | 静态解析、禁止 eval、Filter 白名单 |

### 9.2 关键假设

- 用户已拥有至少一个 LLM Provider 的 API Key。
- 目标网页可被浏览器正常访问（动态渲染 SPA 需等待 DOM 稳定后提取）。
- 用户理解本地优先的数据模型，云端同步需自行配置 WebDAV/S3。
- Interpreter 调用会产生 LLM 费用，用户明确知情。

---

## 10. 验收标准

### 10.1 功能验收

| 编号 | 验收项 | 通过标准 |
|:---:|:---|:---|
| AC-1 | 正文提取 | 在 20 个常见新闻/博客/文档站点上，Readability 成功提取正文且去广告率 ≥ 90% |
| AC-2 | 页面隔离 | 同一浏览器不同 URL 打开侧边栏，对话记录互不影响 |
| AC-3 | 多模型并发 | 同时勾选 2 个模型，均能在 10 秒内返回首 token 并流式显示 |
| AC-4 | 对话持久化 | 关闭并重新打开侧边栏后，同一页面历史对话完整恢复 |
| AC-5 | 全量导出 | 1,000 条历史记录导出为 `.zip` 且可在新浏览器导入后恢复 |
| AC-6 | 安全存储 | 通过 DevTools 无法明文读取 `chrome.storage.local` 中的 API Key |
| AC-7 | 快捷指令 | 6 个预设快捷指令均可用，输出符合 Prompt 摘要预期 |
| AC-8 | 全文检索 | 10,000 条记录中检索关键词耗时 ≤ 500ms |
| AC-9 | 模板变量 | 6 类变量（Preset/Prompt/Meta/Selector/SelectorHtml/Schema）均可正确解析 |
| AC-10 | 模板触发器 | 通过 URL 前缀、正则、Schema 三种规则分别触发对应模板 |
| AC-11 | 模板逻辑 | 支持 `if`、`for`、`set`、`??` 语法，结果正确 |
| AC-12 | Filters | 常用 Filters（date、replace、join、slice、markdown、strip_md）结果正确 |
| AC-13 | 模型适配器 | 至少完成 OpenAI、Anthropic、Gemini、DeepSeek、Ollama 五类引擎适配 |
| AC-14 | 高亮 | 划选文本可添加高亮，刷新页面后高亮自动恢复 |
| AC-15 | 阅读模式 | 阅读模式下正文可正常阅读且高亮/对话功能可用 |
| AC-16 | Interpreter | Prompt 变量可调用 LLM 并正确替换到模板输出中 |

### 10.2 非功能验收

| 编号 | 验收项 | 通过标准 |
|:---:|:---|:---|
| AC-17 | 性能 | 侧边栏冷启动 ≤ 500ms，流式生成帧率 ≥ 45fps |
| AC-18 | 安全 | XSS 扫描通过，无未净化外部 HTML 注入，无 eval 调用 |
| AC-19 | 兼容性 | 扩展在 Chrome、Edge、Firefox 上成功打包并运行 |
| AC-20 | 稳定性 | 连续 SSE 断线 5 次内可自动重连，失败给出明确提示 |

---

## 11. 附录

### 11.1 技术选型矩阵

| 技术维度 | 选型方案 | 引入理由 |
|:---|:---|:---|
| 基础工程框架 | `WXT` (v0.19.x) | 基于 Vite，完美支持 MV3，对 Popup / Side Panel / 后台脚本提供开箱即用 HMR |
| 视图层框架 | `Vue 3` (SFC) + TypeScript | 组合式 API 便于多模型网格渲染的复用与解耦，TS 强类型降低大文本 Payload 组装出错率 |
| 样式与 UI 库 | `UnoCSS` + `Reka UI` | UnoCSS 零 runtime 开销，Reka UI 无样式原语便于像素级还原冷淡风视觉 |
| 多 Provider 引擎 | 自研 `IEngine` 接口 + 适配器 | 基类统一处理 SSE / 重试 / 超时，子类仅覆盖差异化方法 |
| 正文提取 | `@mozilla/readability` + `defuddle` + `turndown` | Readability 本地毫秒级提取，defuddle 兜底一步完成 DOM → Markdown |
| 流式解析 | `eventsource-parser` | 解决中文多字节字符在 Chunks 截断时的乱码问题（生产验证） |
| 增量 JSON 解析 | `best-effort-json-parser` | 流式场景下解析不完整 JSON 响应 |
| 海量数据库 | `Dexie.js` | 规避 5MB 限制，支持 GB 级存储，百万 Token 级超长文本检索 |
| 跨浏览器兼容 | `webextension-polyfill` | 一套代码同时打包 Chromium / Firefox / Safari |
| MD 渲染引擎 | `markdown-it` | 高性能，配合流式输出快速将 LLM 文本转为 HTML |
| XSS 防护 | `DOMPurify` | 渲染大段模型输出及 RSS 抓取的外部 HTML 时强制净化 DOM |
| 模板压缩 | `lz-string` | 压缩模板 JSON 至 UTF16，突破 `chrome.storage.sync` 单 Key 8KB 上限 |
| 日期处理 | `dayjs` | 轻量级日期格式化与相对时间展示 |
| 语音合成 | Web Speech API / Edge TTS | 30+ 语言朗读，零额外依赖 |
| 状态管理 | `Pinia` + `PersistedState` | 基于 `chrome.storage.local` 序列化，保障 Popup 与 Side Panel 状态秒级互通 |
| 虚拟滚动 | `vue-virtual-scroller` | 万条历史记录仅渲染视口可见节点 |
| ZIP 打包 | `jszip` | Web Worker 中打包 Dexie 全量数据为 `.zip` |
| WebDAV 同步 | `webdav` npm 库 | REST API 将 Markdown 增量 PUT 到坚果云 / Nextcloud |
| 模板编译 | 自研 AST 解释器 | 安全解析变量、逻辑、Filter，避免 eval 注入 |
| 高亮持久化 | 基于 `rangy` / 自研 range 序列化 | 保存高亮位置并在页面加载时恢复 |

### 11.2 模板变量速查

```
{{content}}                    → 当前页面提取正文（Markdown）
{{contentHtml}}                → 当前页面提取正文（HTML）
{{fullHtml}}                   → 页面完整 HTML（已清洗）
{{title}} / {{author}} / {{url}} → 预置元数据
{{selection}} / {{selectionHtml}} → 用户划选内容
{{highlights}}                 → 页面高亮列表
{{words}}                      → 字数统计
{{date}} / {{time}}            → 当前日期/时间
{{meta:name:description}}      → Meta name 变量
{{meta:property:og:title}}   → Open Graph 变量
{{selector:h1}}                → CSS Selector 文本
{{selector:img.hero?src}}      → CSS Selector 属性
{{selectorHtml:#main}}         → CSS Selector HTML
{{schema:@Article.headline}} → Schema.org 变量
{{schema:author.name}}         → Schema.org 嵌套变量
{{"a summary of the page"}}  → Interpreter Prompt 变量
```

### 11.3 支持的主流 Provider（预设模板）

| Provider | 协议 | 说明 |
|:---|:---|:---|
| OpenAI | Chat Completions / Responses | 官方端点自动选择 Responses API |
| Anthropic | Messages | 支持 Claude 系列 |
| Google Gemini | Chat Completions | `generativelanguage.googleapis.com` |
| DeepSeek | OpenAI 兼容 | `api.deepseek.com/v1/chat/completions` |
| Azure OpenAI | Chat Completions | 需配置 resource / deployment |
| OpenRouter | OpenAI 兼容 | 统一入口 |
| Perplexity | OpenAI 兼容 | Sonar 系列 |
| xAI | OpenAI 兼容 | Grok 系列 |
| Hugging Face | Chat Completions | 推理 API |
| Meta | Chat Completions | Llama 官方 API |
| Ollama | 本地 | `http://127.0.0.1:11434/api/chat`，需配置 CORS |
| Cohere | OpenAI 兼容 | 后续扩展 |
| Kimi | OpenAI 兼容 | 后续扩展 |

### 11.4 Filter 分类速查

| 分类 | 常用 Filters |
|:---|:---|
| 日期 | `date`、`date_modify`、`duration` |
| 文本转换 | `camel`、`kebab`、`snake`、`lower`、`upper`、`title`、`capitalize`、`uncamel` |
| 文本处理 | `replace`、`trim`、`safe_name`、`decode_uri` |
| Markdown | `blockquote`、`callout`、`footnote`、`image`、`link`、`list`、`table`、`wikilink` |
| HTML | `markdown`、`remove_html`、`remove_tags`、`remove_attr`、`replace_tags`、`strip_tags`、`strip_attr` |
| 数组/对象 | `first`、`last`、`join`、`map`、`merge`、`nth`、`object`、`slice`、`split`、`template`、`unique` |
| 数字 | `calc`、`length`、`round` |

### 11.5 模板逻辑速查

```twig
{% if author %}Author: {{author}}{% endif %}
{% if price >= 100 %}Expensive{% elseif price >= 50 %}Medium{% else %}Cheap{% endif %}
{% for tag in tags %}{{loop.index}}. {{tag}}{% endfor %}
{% set slug = title|lower|replace:" ":"-" %}
{{title ?? "Untitled"}}
```

---

## 12. 版本记录

| 版本 | 日期 | 修改人 | 说明 |
|:---:|:---|:---|:---|
| v1.0 | — | — | 初稿 |
| v1.1 | — | — | 详细设计稿 |
| v1.2 | 2026-06-23 | QClaw | 重新整理需求结构，补齐目标用户、术语、非功能性需求、边界、风险与验收标准 |
| v1.3 | 2026-06-23 | QClaw | 补充参考实现细节：完整模板变量/触发器/逻辑/Filter、Interpreter、多引擎适配器、高亮与阅读模式、Provider 配置结构 |

---

*End of Document*
