# PRD: AI Reader Chrome Extension

> **Version**: 1.0.0
> **Date**: 2026-06-18
> **Status**: ready-for-agent
> **Labels**: ready-for-agent

---

## Problem Statement

阅读长文章和复杂网页时，用户面临以下痛点：

1. **信息过载**：万字长文难以快速抓住核心要点，阅读效率低下
2. **单一视角局限**：不同 AI 模型对同一内容的理解和总结各有侧重，单一模型回答可能遗漏关键信息或产生偏见
3. **长文本处理困难**：超出模型上下文限制的文章无法一次性处理，需要手动分段
4. **内容留存不便**：有价值的阅读内容缺乏便捷的导出和整理方式
5. **工具分散**：摘要、对比、导出功能分散在不同工具中，体验割裂
6. **隐私安全顾虑**：敏感内容（内部文档、私人通信）直接发送到云端 API 存在泄露风险，缺乏本地模型选项
7. **跨设备一致性差**：用户的 API 配置、历史记录、自定义模板无法跨设备同步
8. **动态内容提取困难**：现代 SPA 页面、无限滚动、懒加载等动态渲染场景下，传统提取方式只能拿到初始 HTML，内容不完整
9. **成本不可控**：用户在不知情的情况下可能消耗大量 token 费用，缺乏预算感知
10. **非技术用户门槛高**：API Key 配置、模型选择、参数调优对非技术用户来说过于复杂

## Solution

构建一个基于 Chrome 扩展（Manifest V3）的 AI 阅读助手，核心差异化在于 **多模型并行提问 + 对比展示**。用户打开任意网页，一键触发多个 LLM 并行处理，在 Side Panel 分栏展示各模型回答，实现"一眼看尽不同视角"。同时提供 Markdown/PDF/Notion/Obsidian 多格式导出，以及追问对话、高亮标注、自定义模板、本地模型支持等生产级功能。

### 核心价值主张

- **多模型对比**：唯一支持多 LLM 并行处理 + 分栏对比的 Chrome 扩展
- **隐私优先**：支持 Ollama / LM Studio 本地模型，敏感内容不出设备
- **生产级体验**：流式响应、成本预估、历史记录、跨设备同步，开箱即用
- **知识管理闭环**：从阅读 → 总结 → 追问 → 导出，一站式完成

---

## User Stories

### 核心阅读与总结

1. As a researcher, I want to select multiple LLM providers and send the same article to all of them simultaneously, so that I can compare different models' perspectives and get a more comprehensive understanding
2. As a heavy reader, I want the extension to automatically split long articles (>8000 words) into chunks and summarize them using Map-Reduce, so that I can get summaries of arbitrarily long content without manual segmentation
3. As a user reading a foreign language article, I want the summary to be generated in Chinese regardless of the source language, so that I can understand content in my native language
4. As a user who prefers structure, I want the summary to include headings and bullet points rather than a wall of text, so that I can scan it quickly
5. As a non-technical user, I want the extension to work out of the box with sensible defaults (OpenAI GPT-4o-mini), so that I don't need to configure anything to start using it
6. As a user reading dynamic content (SPA, infinite scroll), I want the content extraction to handle JavaScript-rendered pages correctly, so that I get the full article not just the initial HTML
7. As a mobile knowledge worker, I want the popup to provide quick one-click summary trigger when I don't need the full Side Panel, so that I can get fast summaries on the go

### 追问与深度交互

8. As a power user, I want to ask follow-up questions based on the article content, so that I can dive deeper into specific topics without leaving the page
9. As a user who found an insightful paragraph, I want to select text and ask a specific question about it, so that I can get targeted explanations without re-reading the entire article
10. As a productivity-focused user, I want the Side Panel to stay open while I browse, so that I can refer back to the summary without re-triggering it
11. As a content creator, I want to copy a specific model's response with one click, so that I can quote it in my own writing

### 模型管理与成本控制

12. As a user with limited API budget, I want to choose which models to enable per-request and see estimated token costs before sending, so that I can control my spending
13. As a user evaluating models, I want to see response time and token usage for each model, so that I can compare performance and cost
14. As a user with privacy concerns, I want to use local models (Ollama/LM Studio) without sending data to cloud APIs, so that I can process sensitive content locally
15. As a frequent user, I want to save my preferred model combination as a preset, so that I don't need to re-select models every time
16. As a developer, I want to add custom prompt templates for different use cases (academic/executive/bullet points), so that I can tailor the output style to my needs

### 配置与安全

17. As a new user, I want to configure my API keys in the Options page with clear provider-specific instructions, so that I can get started quickly
18. As a user with multiple devices, I want my API key configuration to be securely stored in chrome.storage with encryption, so that my credentials are protected
19. As a user who wants to share the extension with colleagues, I want to export and import my configuration (excluding API keys), so that others can quickly set up their environment

### 导出与知识管理

20. As a content curator, I want to export the summary and original content to Markdown/PDF/Notion/Obsidian, so that I can save valuable content to my knowledge management system
21. As a frequent user, I want my history of summarized articles to be saved locally, so that I can revisit past summaries without re-processing
22. As an Obsidian user, I want to send summaries directly to my vault via Obsidian URI, so that I can integrate reading notes into my existing knowledge graph
23. As a Notion user, I want to export summaries to a specified Notion database, so that I can organize reading notes alongside my other project notes
24. As a user who wants to share summaries, I want to export to PDF with proper formatting (headings, code blocks, tables), so that I can send them to colleagues who don't use the extension

### 高亮与标注

25. As a user who wants to mark important passages, I want to highlight text on the page and see those highlights listed in the Side Panel, so that I can review key points later
26. As a user reviewing highlights, I want to ask a specific LLM to explain or expand on a highlighted section, so that I can deepen my understanding of key passages
27. As a researcher, I want to export my highlights alongside the summary, so that I have a complete record of what I found important

### 流式体验与并发

28. As a user comparing model outputs, I want each model's response to stream independently with its own progress indicator, so that I know which models are still thinking
29. As a user who changed their mind, I want to cancel a specific model's request without affecting others, so that I can save tokens on models I no longer care about
30. As a user who accidentally closed the Side Panel, I want the in-progress streams to be cancelled cleanly without orphaned requests, so that I don't waste API quota

### 高级场景

31. As a developer, I want to integrate the extension with my custom LLM endpoint (e.g., vLLM, text-generation-webui), so that I can use self-hosted models with OpenAI-compatible APIs
32. As an academic researcher, I want to use specialized prompt templates for papers (abstract → methodology → results → limitations), so that I can quickly assess whether a paper is worth reading in full
33. As a team lead, I want to share a prompt template with my team via import/export, so that we maintain consistent summary quality across the team
34. As a user reading paywalled content (that I have access to), I want the extension to extract the full content after I've logged in, so that I can summarize articles behind paywalls
35. As a user with slow internet, I want the extension to handle streaming timeouts gracefully with retry logic, so that I don't lose progress due to network issues
36. As a power user, I want keyboard shortcuts for common actions (trigger summary, toggle side panel, switch models), so that I can operate the extension without reaching for the mouse
37. As a user who reads in multiple languages, I want to configure the output language independently of the source language, so that I can read Chinese summaries of English articles and vice versa

---

## Implementation Decisions

### 1. 多模型并行架构（Deep Module）

提取一个可独立测试的 `LLMProvider` 抽象层，作为整个扩展的核心 deep module：

```typescript
interface LLMProvider {
  readonly name: string;
  readonly id: string;
  readonly maxContextTokens: number;

  streamChat(messages: ChatMessage[], options: ChatOptions): AsyncGenerator<StreamChunk>;
  streamSummarize(content: string, options: SummarizeOptions): AsyncGenerator<StreamChunk>;
  estimateCost(inputTokens: number, outputTokens: number): number; // in USD
}
```

每个 Provider 实现封装该供应商的 API 细节（SSE 解析、认证头、错误码映射）。上层只关心统一接口，不关心 OpenAI 的 `data: [DONE]` 和 Anthropic 的 `event: content_block_delta` 差异。

**Provider 注册机制**：采用注册式而非硬编码，新 Provider 通过 `providerRegistry.register()` 注册，支持第三方扩展。

**支持的 Provider（一期）**：
- OpenAI（GPT-4o, GPT-4o-mini, GPT-4-turbo）
- Anthropic（Claude 3.5 Sonnet, Claude 3 Haiku）
- Google（Gemini 1.5 Pro, Gemini 1.5 Flash）
- Ollama（本地模型，自动检测已安装模型）
- LM Studio（OpenAI 兼容 API）
- 自定义 OpenAI 兼容端点（vLLM, text-generation-webui 等）

### 2. 并发控制与独立流管理

使用 `AbortController` 实现每个请求独立取消：

```typescript
type ActiveStream = {
  providerId: string;
  controller: AbortController;
  reader: ReadableStreamDefaultReader;
};

const activeStreams = new Map<string, ActiveStream>();

function abortStream(providerId: string) {
  activeStreams.get(providerId)?.controller.abort();
}

function abortAllStreams() {
  activeStreams.forEach(s => s.controller.abort());
}
```

UI 层每个模型卡片独立订阅自己的流，互不阻塞。快模型先展示，慢模型后补全。

**错误隔离**：单个 Provider 请求失败（网络错误、API 限流、认证失败）不影响其他 Provider 的流式响应。失败卡片展示错误信息和重试按钮。

**Side Panel 生命周期管理**：Side Panel 关闭时自动调用 `abortAllStreams()`，确保不留孤儿请求。

### 3. Map-Reduce 长文本处理引擎（Deep Module）

独立可测试的分块与合并模块：

```typescript
interface MapReduceEngine {
  chunk(text: string, maxTokens: number): string[];
  map(chunk: string, provider: LLMProvider, prompt: string): Promise<string>;
  reduce(partialSummaries: string[], provider: LLMProvider): Promise<string>;
}
```

**分块策略**：
- 优先按段落边界分块，避免句子被截断
- 每块不超过模型 `maxContextTokens` 的 60%，留出 prompt 和输出空间
- 中文按句号/换行分块，英文按段落分块

**Token 估算**：中文字符 ≈ 1.5 tokens，英文 ≈ 0.25 tokens（基于 tiktoken 估算经验值，不引入额外依赖）

### 4. Side Panel 分栏布局响应式策略

| 启用模型数 | 布局 |
|-----------|------|
| 1 | 单栏全宽 |
| 2 | 左右两栏 |
| 3-4 | 2x2 网格 |
| 5+ | 横向滚动卡片 |

每个模型卡片固定最小宽度 320px，保证可读性。超出时横向滚动而非挤压。

卡片内含：模型名称、状态指示器（thinking/streaming/done/error）、流式 Markdown 渲染区、底部操作栏（复制/重试/追问）、token 用量与耗时统计。

### 5. Content Script 正文提取策略（Deep Module）

三层降级提取管道：

```typescript
interface ContentExtractor {
  extract(): Promise<ExtractedContent>;
}

interface ExtractedContent {
  title: string;
  content: string;        // Markdown 格式
  url: string;
  excerpt: string;
  wordCount: number;
  extractionMethod: 'defuddle' | 'readability' | 'fallback';
}
```

- **主路径**：`defuddle`（Obsidian Clipper 同款，对中文内容优化好，支持 schema.org、脚注、数学公式）
- **备选路径**：`@mozilla/readability`（Mozilla 维护，兼容性强）
- **兜底路径**：纯文本提取（去除 script/style 标签后的 innerText）

提取失败时自动降级，保证任何页面都能拿到内容。

**SPA / 动态内容处理**：
- 内容脚本注入后等待 2 秒，让懒加载内容渲染完成
- 提供"重新提取"按钮，用户可在页面完全加载后手动触发
- 监听 `MutationObserver`，检测页面主内容区域是否仍在变化，变化停止后再提取

### 6. 存储分层设计

| 数据类型 | 存储位置 | 容量 | 加密 |
|---------|---------|------|------|
| API Keys | `chrome.storage.local` + AES-GCM 加密 | 5MB | ✅ |
| 历史记录 | `chrome.storage.local` + lz-string 压缩 | 5MB | ❌ |
| 模板配置 | `chrome.storage.local` | 5MB | ❌ |
| 高亮数据 | `chrome.storage.local` | 5MB | ❌ |
| 用户设置 | `chrome.storage.sync` | 100KB | ❌ |
| 当前会话状态 | 内存（React state） | 无限制 | — |

历史记录压缩后可存约 500-1000 条摘要，足够日常使用。

**API Key 加密方案**：使用 Web Crypto API 的 `SubtleCrypto.encrypt()` (AES-GCM 256)，密钥派生自用户设定的主密码 + 设备指纹 salt。首次使用时要求用户设置主密码。

**跨设备同步**：`chrome.storage.sync` 仅同步非敏感设置（模型偏好、输出语言、模板配置等），不同步 API Key。API Key 需在每个设备单独配置。

### 7. 成本提示机制

发送请求前基于字符数估算 token（中文字符 ≈ 1.5 tokens，英文 ≈ 0.25 tokens），乘以各模型单价，展示预估费用。用户确认后再发送。

**成本展示**：
- 请求前：弹窗显示总预估费用 + 各模型明细，用户确认后才发送
- 请求中：每个卡片底部实时累计已消耗的 token 数
- 请求后：显示实际 token 用量和最终费用
- 月度统计：Options 页面展示本月累计消耗（按模型分类）

### 8. 追问对话上下文管理

每次追问携带：
- 原始文章提取内容（或前序摘要）
- 当前模型此前的全部对话历史
- 用户新问题

上下文长度超过模型限制时，自动截断最早的消息（保留 system prompt 和最近 N 轮对话，N 由模型上下文窗口决定）。

**追问隔离**：每个模型的追问历史相互独立，在 A 模型的追问不会影响 B 模型的上下文。

### 9. 高亮标注系统

Content Script 注入高亮层：
- 用户选中文本 → 右键菜单 / 浮动按钮 → 添加高亮
- 高亮数据持久化到 `chrome.storage.local`，按 URL 索引
- 重新打开同一页面时自动恢复高亮
- Side Panel 展示高亮列表，点击跳转到原文位置

### 10. 导出模块设计

统一导出接口，支持多格式：

```typescript
interface Exporter {
  export(data: ExportData): Promise<void>;
}

interface ExportData {
  title: string;
  url: string;
  content: string;           // 原文 Markdown
  summaries: ModelSummary[]; // 各模型总结
  highlights: Highlight[];   // 高亮列表
  conversation?: ChatMessage[]; // 追问历史
  metadata: {
    extractedAt: string;
    exportedAt: string;
    wordCount: number;
  };
}
```

- **Markdown**：生成标准 .md 文件，包含 frontmatter（title, url, date, models）
- **PDF**：使用 jsPDF + html2canvas，支持中文字体（内嵌 NotoSansCJK 子集）
- **Obsidian**：通过 `obsidian://` URI 协议直接写入指定 vault/folder
- **Notion**：通过 Notion API（需用户配置 Integration Token）写入指定 database
- **剪藏到本地**：通过 `chrome.downloads.download()` 保存到用户下载目录

### 11. Options 页面设计

分 Tab 式设置页：
- **通用**：默认输出语言、主题（light/dark/auto）、Side Panel 默认宽度
- **模型管理**：各 Provider 的 API Key 配置、默认模型选择、模型预设组合
- **模板管理**：自定义 prompt 模板的增删改查、导入导出
- **成本统计**：月度消耗面板、按模型/日期维度的图表
- **高级**：主密码修改、数据导入导出、清除历史、调试模式

### 12. Popup 快捷操作

Popup 提供轻量级快速入口：
- 一键总结（使用默认模型组合）
- 选中总结（对当前选中文本总结）
- 切换模型预设
- 快捷模板选择
- 打开/关闭 Side Panel

Popup 不展示完整总结结果——结果在 Side Panel 中展示。Popup 仅作为快速触发入口。

### 13. 消息通信架构

Content Script ↔ Background Service Worker ↔ Side Panel 之间的通信采用 `chrome.runtime.sendMessage` + `chrome.runtime.onMessage`，封装统一的消息总线：

```typescript
type Message =
  | { type: 'EXTRACT_CONTENT' }
  | { type: 'SUMMARIZE'; providerIds: string[]; templateId: string }
  | { type: 'ABORT_STREAM'; providerId: string }
  | { type: 'ABORT_ALL' }
  | { type: 'FOLLOW_UP'; providerId: string; question: string }
  | { type: 'HIGHLIGHT_ADD'; text: string; range: Range }
  | { type: 'EXPORT'; format: ExportFormat; data: ExportData };
```

### 14. 键盘快捷键

| 快捷键 | 功能 |
|--------|------|
| `Alt+S` | 触发总结（使用默认模型组合） |
| `Alt+Shift+S` | 打开/关闭 Side Panel |
| `Alt+1~9` | 切换第 N 个模型的启用/禁用 |
| `Alt+E` | 导出菜单 |
| `Esc` | 关闭 Side Panel / 取消所有流 |

---

## Testing Decisions

### 测试策略

- **只测外部行为，不测实现细节**：Provider 的测试验证输入请求结构和输出解析，不验证内部 fetch 调用次数
- **流式响应用 ReadableStream mock**：模拟 SSE 分片到达，验证 UI 是否正确增量渲染
- **集成测试用真实 HTML fixture**：不 mock DOM，用 jsdom + 真实 HTML 验证提取准确性

### 需要测试的模块

| 模块 | 测试类型 | 说明 | 优先级 |
|------|---------|------|--------|
| LLMProvider 各实现 | 单元测试 | mock fetch，验证请求格式和 SSE 解析 | P0 |
| Map-Reduce 引擎 | 单元测试 | 固定文本输入，验证分块策略和合并输出 | P0 |
| 正文提取器 | 集成测试 | 用真实 HTML fixture 测试提取准确性 | P0 |
| 多模型并发管理 | 单元测试 | 验证独立取消、全部取消、错误隔离 | P0 |
| 存储封装 | 单元测试 | mock chrome.storage，验证读写和加密 | P1 |
| 导出模块 | 单元测试 | 验证各格式的输出结构和内容完整性 | P1 |
| 成本估算 | 单元测试 | 验证中英文 token 估算准确性 | P1 |
| 消息总线 | 单元测试 | 验证各消息类型的路由和错误处理 | P2 |
| 高亮系统 | 集成测试 | 验证高亮添加、持久化、恢复 | P2 |

### 测试工具链

- **测试框架**：Vitest（比 Jest 更快，原生 ESM 支持）
- **DOM 模拟**：jsdom + @testing-library/react
- **Mock 工具**：msw（Mock Service Worker，用于拦截 fetch 请求）
- **覆盖率目标**：核心模块 ≥ 80%，UI 组件 ≥ 60%

---

## Out of Scope

3. **服务端组件**：纯客户端扩展，不包含任何后端服务、数据库、用户系统
6. **广告拦截/页面净化**：不做页面广告移除，仅在提取正文时自然过滤非内容区域
7. **RSS 订阅集成**： RSS 源管理和自动摘要
12. **自动更新模型列表**：模型列表支持自动拉取最新可用模型
13. **多标签页并行总结**：同一时间仅处理当前活跃标签页的内容
14. **端到端加密同步**：跨设备同步仅限非敏感设置，不包含端到端加密的完整同步方案

---

## Further Notes

### 技术栈选择

| 层 | 选型 | 理由 |
|---|------|------|
| 状态管理 | Zustand | 比 Redux 轻量，比 Context 更适合高频更新的流式场景 |
| 样式 | Tailwind CSS + CSS Variables | 快速开发 + 主题切换（dark/light）通过 CSS Variables 实现 |
| HTML 消毒 | dompurify | 业界标准，防 XSS |
| LLM 调用 | 原生 fetch + ReadableStream | 不引入 SDK，减小包体积，直接处理 SSE |
| 日期处理 | dayjs | 轻量（2KB），API 兼容 moment |
| 压缩存储 | lz-string | 模板和历史记录压缩 |
| 图标 | lucide-react | 现代图标库，Tree-shakeable |
| PDF 导出 | jsPDF + html2canvas | 客户端生成，无需后端 |
| 测试 | Vitest + msw + jsdom | 快速、原生 ESM、API mocking |

### 关键依赖库选型

| 模块 | Obsidian Clipper 用的 | 更优/替代选择 | 说明 |
|------|----------------------|-------------|------|
| **正文提取** | defuddle (kepano) | defuddle ✅ | 比 @mozilla/readability 更强，支持 schema.org、脚注、数学公式 |
| **HTML 消毒** | dompurify | dompurify ✅ | 业界标准 |
| **Markdown 渲染** | — | react-markdown + remark-gfm | 在 side panel 中渲染 LLM 输出 |
| **LLM 调用** | — | 原生 fetch + ReadableStream | 或直接 fetch，支持流式 |
| **日期处理** | dayjs | dayjs ✅ | 轻量 |
| **压缩存储** | lz-string | lz-string ✅ | 模板压缩 |
| **图标** | lucide | lucide ✅ | 现代图标库 |
| **PDF 导出** | — | jspdf + html2canvas | 客户端生成 PDF |

### 架构总览

```
┌─────────────────────────────────────────────────┐
│              Chrome Extension (MV3)              │
├─────────────────────────────────────────────────┤
│                                                  │
│  ┌──────────────┐    ┌───────────────────────┐  │
│  │ Content Script│    │  Background Service   │  │
│  │               │    │       Worker          │  │
│  │ • defuddle    │    │                       │  │
│  │   提取正文    │────▶│  • LLM API 调用       │  │
│  │ • DOMPurify   │    │    (流式响应)         │  │
│  │   消毒        │    │  • 多 Provider 抽象   │  │
│  │ • Highlight   │    │    (OpenAI/Claude/    │  │
│  │   高亮标注    │    │     Gemini/Ollama/   │  │
│  │               │    │     自定义端点)       │  │
│  └──────────────┘    └──────────┬────────────┘  │
│                                 │                │
│  ┌──────────────┐    ┌──────────▼────────────┐  │
│  │ Popup /       │    │  Side Panel            │  │
│  │ Quick Actions │    │  (主交互界面)          │  │
│  │               │    │                        │  │
│  │ • 一键总结    │    │  • 多模型分栏对比展示  │  │
│  │ • 选中总结    │    │  • 追问/扩展对话       │  │
│  │ • 快捷模板    │    │  • 高亮列表管理        │  │
│  │ • 模型切换    │    │  • 历史记录            │  │
│  └──────────────┘    │  • 导出菜单            │  │
│                       └──────────┬────────────┘  │
│  ┌──────────────┐    ┌──────────▼────────────┐  │
│  │ Options Page  │    │  Export Module         │  │
│  │               │    │                        │  │
│  │ • API Key 配置│    │  • Markdown 下载       │  │
│  │ • 模型管理    │    │  • PDF 导出            │  │
│  │ • 模板管理    │    │  • Obsidian URI        │  │
│  │ • 成本统计    │    │  • Notion API          │  │
│  │ • 数据管理    │    │  • 剪藏到本地          │  │
│  └──────────────┘    └───────────────────────┘  │
│                                                  │
│  ┌──────────────────────────────────────────┐   │
│  │         Storage Layer                    │   │
│  │  • chrome.storage.local (加密/压缩)      │   │
│  │  • chrome.storage.sync (设置同步)        │   │
│  │  • lz-string 压缩模板                    │   │
│  │  • AES-GCM API Key 加密                  │   │
│  └──────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```


### 安全考量

1. **CSP 合规**：MV3 要求严格的 Content Security Policy，不使用 eval 和内联脚本
2. **API Key 保护**：密钥不出现在 content script 可访问的上下文中，仅 background service worker 可读取
3. **数据最小化**：发送给 LLM 的内容仅包含提取后的正文，不包含页面 cookie、用户信息等
4. **本地模型通信**：Ollama / LM Studio 通过 `localhost` 通信，数据不经过互联网
5. **权限最小化**：仅申请 `activeTab`, `sidePanel`, `storage`, `contextMenus` 权限，不申请 `tabs`（不需要读取所有标签页）

### 可访问性（Accessibility）

- 所有交互元素支持键盘操作（Tab 导航、Enter/Space 激活）
- Side Panel 支持 ARIA 标签和 live region（流式响应区域标记为 `aria-live="polite"`）
- 颜色对比度满足 WCAG 2.1 AA 标准
- 支持 `prefers-reduced-motion`，减少动画
