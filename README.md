
## 项目概述

**AI Reader** 是一个 Chrome 浏览器扩展（基于 WXT + Vue 3 + UnoCSS），核心功能是：**从当前网页提取正文内容，并同时发送给多个 AI 模型进行并排对比回答**。

---

## 一、内容提取

- **三层降级策略**：
  1. **defuddle 异步解析**（8秒超时）—— 智能提取正文并转为 Markdown
  2. **defuddle 同步回退** —— 异步失败时尝试同步解析
  3. **innerText 兜底** —— 去除 script/style 后取页面纯文本
- 提取结果包含：标题、URL、正文内容、字数统计
- 支持**过期检测**：提取超过 5 分钟标记为 stale

---

## 二、多模型并排对比

这是核心亮点功能：

- 用户启用多个 Provider（如 OpenAI + Anthropic + Gemini），点击 Run 后**同时**向所有模型发送相同 prompt
- 每个模型的响应以**独立卡片**流式显示（SSE），实时逐字输出
- 响应网格布局：1 个模型单列，2-4 个双列，超过 4 个横向滚动
- 每个卡片显示：模型名称、流式文本、耗时、token 数、预估费用
- 支持**单个重试**、**中止单个**、**全部停止**

---

## 三、支持的 AI Provider

| Provider | 说明 |
|----------|------|
| **OpenAI** | GPT-4o、GPT-4 Turbo、o1 等 |
| **Anthropic** | Claude Sonnet、Haiku、Opus |
| **Google Gemini** | Gemini 2.0 Flash、Pro |
| **DeepSeek** | DeepSeek-V3、R1 等国产模型 |
| **Ollama** | 本地模型（无需 API Key） |
| **Custom** | 任意 OpenAI API 兼容服务（OpenRouter、Groq、Moonshot 等） |

每个 Provider 可独立配置 API Key、Base URL、Model ID。

---

## 四、Prompt 模板系统

- **内置 4 个模板**：
  - **Summarize** — 中文摘要
  - **Explain Simply** — 简单解释
  - **Key Takeaways** — 关键要点
  - **Action Items** — 可执行建议
- 支持**自定义模板**（最多 20 个）：在设置页添加/编辑/删除
- 在 Side Panel 的 ActionBar 中可一键选择模板触发
- 支持**自定义提示词输入**，回车或点击发送

---

## 五、追问对话（Follow-up）

- 每个模型卡片支持**追问**：在模型回答后继续输入问题
- 自动构建上下文：将文章内容 + 历史对话 + 新问题组合成 prompt

---

## 七、历史记录

- 每次对比完成后**自动保存**到本地存储（最多 50 条）
- 记录包含：页面标题、URL、字数、prompt、每个模型的完整回答、token 数、费用、耗时
- 存储使用 **LZ-String 压缩**，节省 chrome.storage 空间
- 历史面板可查看、点击跳转原页面、删除单条、清空全部
- 设置页显示总记录数、累计回答数、累计花费

---

## 八、导出功能

支持 4 种导出格式：

| 格式 | 说明 |
|------|------|
| **Markdown** | 生成带标题和模型分节的 .md 文件 |
| **PDF** | 使用 jsPDF 生成带页码的 PDF 文件 |
| **Obsidian URI** | 通过 obsidian:// 协议直接创建笔记（超长内容回退到剪贴板） |
| **Notion** | 复制 Markdown 到剪贴板，手动粘贴到 Notion |

---

## 九、配置管理

设置页分 4 个板块：

1. **General** — 主题切换、已启用 Provider 数量、历史统计
2. **Providers** — 每个 Provider 的 API Key / Base URL / Model 配置，开关启用/禁用
3. **Templates** — Prompt 模板的增删改
4. **Data** — 导出配置（JSON，不含 API Key）、导入配置、清空历史

---

## 十、UI 与交互

- **三个入口页面**：Popup（快速触发）、Side Panel（主工作区）、Options（设置页）
- **主题系统**：浅色 / 深色 / 跟随系统，持久化到 storage
- **离线检测**：断网时顶部显示警告 banner
- **键盘快捷键**：
  - `summarize` — 提取内容
  - `toggle-panel` — 打开 Side Panel
  - `abort-all` — 停止所有请求
  - `Escape` — 停止请求 / 关闭历史面板
- **骨架屏加载**、**错误边界**、**Loading 状态**等完善的 UI 状态管理
- 风格模仿 Obsidian 的设计语言（CSS 变量、圆角、pill 标签等）

---

## 十一、技术架构

| 层 | 技术 |
|----|------|
| 框架 | WXT (浏览器扩展框架) |
| 前端 | Vue 3 + Pinia + UnoCSS |
| LLM 通信 | Background Service Worker + Port-based SSE 流式传输 |
| 存储 | chrome.storage.local + LZ-String 压缩 |
| 内容提取 | defuddle + innerText fallback |
| 导出 | jsPDF + markdown-it + DOMPurify |
| 测试 | Vitest + happy-dom |
