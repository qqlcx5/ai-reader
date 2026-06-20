# 📄 AI Reader — 产品需求文档 (PRD)

> **文档版本**：v2.6 (Architecture Final)
> **产品定位**：浏览器端的全自动化 AI 阅读、比对与综合提炼助手。
> **核心原则**：本地优先、Cherry 多模态交互、海量数据吞吐架构、零中转直连、**无截断长文本支持**。

---

## 一、 系统入口与布局职责

*   **Popup (弹窗)**：轻量控制器。展示当前网页预估字数，提供“快速触发提取”和“进入设置”入口。
*   **Side Panel (侧边栏)**：核心主界面。采用类 Obsidian 视觉风格。承载上下文状态、Cherry 风格多模对话视图、历史记录面板。
*   **Options (设置页)**：分 Tab 布局。管理 Provider 密钥、提示词模板、同步与备份凭据、RSS 订阅源。
*   **全局快捷键**：
    *   `Alt/Option + S`：自动唤起侧边栏，静默提取当前页面并执行默认提示词。
    *   `Alt/Option + P`：显隐侧边栏。
    *   `Escape`：一键中断当前所有网络生成请求。

---

## 二、 核心业务规格 (Functional Specs)

### 模块 1：上下文提取与无界锚定 (Context & Extraction)
*   **三级降级正文提取算法**：
    1.  **本地首选 (`@mozilla/readability`)**：优先在本地执行解析，秒级剥离广告、导航栏，提取纯净正文（如有需要可结合轻量库 `turndown` 转为 Markdown）。
    2.  **API 异步解析 (Defuddle)**：若 Readability 提取异常或为空，调用 Defuddle 接口执行智能提取并转为 Markdown（设定 8 秒超时限制）。
    3.  **兜底提取 (`innerText`)**：若前两步均失败或超时，强制清洗 DOM 树中的 `<script>` 与 `<style>` 节点后，直接提取 `document.body.innerText`。
*   **无限制上下文直通 (No Truncation)**：
    *   **不设硬性字符/Token上限**。为了充分利用现代大模型（如 Gemini 1M+, Claude 200k+）的超长文本处理能力，系统**严禁**在前端对提取的文章内容进行人为截取或丢弃。由底层模型 API 自行决定是否超出 Token 限制。
*   **上下文静默锚定机制**：
    *   侧边栏顶部常驻**“当前上下文状态栏”**。切换浏览器 Tab 时，系统**静默保持**上一次提取的网页作为对话上下文，不打断原有对话流。
    *   提供【⟳ 刷新提取当前 Tab】按钮，供用户主动更新上下文。

### 模块 2：Cherry 风格多模型工作区 (Workspace)
*   **全局并发路由**：输入框上方提供下拉器，可同时勾选 1~4 个模型并发执行。
*   **聚合流式渲染**：
    *   在一个用户提问气泡下方，按选中的模型生成“并排栏目”或“内嵌标签页”。
    *   各模型独立建立 SSE 连接，流式渲染互不阻塞。支持独立重试/中止。
*   **数据透视底栏**：模型卡片底部硬编码显示：`耗时(ms)` | `TTFT` | `Tokens/s` | `消耗量预估`。
*   **单分支追问**：点击某模型卡片底部的“以此继续”，分离出针对该模型的单线对话流。

### 模块 3：高阶 AI 工作流 (Advanced Workflows)
*   **多角色圆桌讨论 (Roundtable)**：用户设定多个角色（如：红方挑刺、蓝方辩护）。系统将不同的 Role Prompt 注入各模型的 System Payload 并发执行，实现跨模型观点交锋。
*   **模型接力链 (Relay Chain)**：配置串行流水线。拦截上游模型输出，自动拼接至下游模型请求中。

### 模块 4：跨端输出与灾备同步 (Export & Backup)
*   **Obsidian URI 直写**：通过 `obsidian://new?vault=[库名]&file=[标题]&content=[内容]` 直接唤起本地 Obsidian 建笔记。
*   **Remotely Save (WebDAV/S3)**：利用 `webdav` npm 库，通过 REST API 将 Markdown `PUT` 到云端。
*   **双轨资产备份（防误删）**：
    *   *手动导出*：通过 `jszip` 在 Web Worker 中打包万条 Dexie 数据为 `.zip` 下载。
    *   *自动备份*：利用 `chrome.alarms` 定期在夜间将全量 JSON 覆盖上传至 WebDAV。

### 模块 5：后台 RSS 自动化流水线
*   **静默增量抓取**：Service Worker 定时拉取 RSS 链接，利用哈希对比去重。
*   **AI 预处理摘要**：调用轻量模型生成 3 句核心摘要。侧边栏展示信息流，扩展图标显示未读数。

---

## 三、 技术选型矩阵与轻量库推荐 (Tech Stack)

> **核心诉求**：引入现成轻量库，坚决避免底层重度二次开发，保障工程收敛。

| 技术维度 | 选型方案 | 引入理由与技术优势 |
| :--- | :--- | :--- |
| **基础工程框架** | `WXT` (v0.19.x) | 基于 Vite 构建，完美支持 MV3 规范；对 Popup、Side Panel、后台与内容脚本提供开箱即用的类型安全与 HMR。 |
| **视图层框架** | `Vue 3` (SFC) + TS | 组合式 API 便于实现多模型网格渲染的复用与解耦；TS 强类型大幅降低大文本 Payload 组装出错率。 |
| **样式与 UI 库** | `UnoCSS` + `Reka UI` | UnoCSS 极致的按需编译，零 runtime 开销；Reka UI 提供无样式原语，便于像素级还原冷淡风视觉。 |
| **状态跨端同步** | `Pinia` + `PersistedState` | 基于 `chrome.storage.local` 实现 Pinia 序列化器，保障 Popup 与 Side Panel 的状态秒级互通。 |
| **流式解析(核心)** | `eventsource-parser` | 替代不稳定原生解析，彻底解决多字节字符（中文）在网络 Chunks 截断时产生的乱码与格式断裂问题。 |
| **海量数据库** | `Dexie.js` / `idb-keyval` | 规避 5MB 限制，完美承载 **百万 Token 级别 (1M+ Tokens)** 的超长文本与上万条历史记录检索，支持 GB 级存储。 |
| **网页正文提纯** | `@mozilla/readability`| **(首选提取器)** 经过 Mozilla 长期生产验证，纯本地运算，零网络请求，极速提取高品质 DOM 正文。 |
| **MD 渲染引擎** | `markdown-it` | 性能极高的 Markdown 解析器，配合流式输出可快速将 LLM 文本转为 HTML。 |
| **客户端防御** | `DOMPurify` | 在渲染大段模型输出及 RSS 抓取的外部 HTML 时，强制在内存中净化 DOM，彻底阻断跨站脚本攻击 (XSS)。 |

---

## 四、 极限长文本与海量数据架构避坑点 (Critical Architecture Notes)

为支撑 **百万 Token 直通** 与 **10,000+ 条** 深长对话记录且保持 UI 丝滑，开发必须遵循以下红线约束：

### 1. 列表渲染内存熔断防御 (Virtual Scrolling)
*   侧边栏的“历史记录列表”必须引入 `vue-virtual-scroller`。无论底层存了多少万条记录，DOM 树强制只渲染视口可见的 ~20 个节点。严禁 `v-for` 全量渲染。

### 2. 数据库读写分离与超长文本懒加载
*   使用 `Dexie.js` 设计**主副表分离**：
    *   **主表 `Conversations`**：仅存元数据（`id`, `title`, `date`, `models`），查询极快。
    *   **副表 `Messages`**：存储携带**几十万至上百万 Token** 的超长对话 JSON。**严禁在列表页查副表，仅当用户点击某条记录进入阅读模式时，才按 ID 懒加载此数据放入内存。**

### 3. Web Worker 隔离全文检索
*   搜索框的“全文检索”范围包含上万条长文本。这在主线程执行正则会引发严重假死。
*   必须将检索逻辑放入原生 `Web Worker`，查询完毕后通过 `postMessage` 将匹配到的摘要高亮切片回传 Vue 渲染。

### 4. 百万级文本的高频渲染防抖 (Debounce/Throttle)
*   引入 1M Tokens 模型意味着前端会面临超大体量的字符渲染。
*   **严禁在 SSE 每接收到一个 chunk 时，对庞大的全量历史上下文重新执行 `markdown-it.render()`**。这会导致页面卡死。
*   **避坑方案**：对正在生成的最新文本块，使用“增量字符串追加（Append）”；或利用 `requestAnimationFrame` 设定约 16ms 延迟的节流重绘，确保长篇大论生成时滚动帧率保持 $\ge 45\text{fps}$。
