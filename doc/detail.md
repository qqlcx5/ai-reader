# AuraMind 研发 PRD

版本：v1.1
技术栈：WXT + Vue 3 + TypeScript + UnoCSS + Reka UI + Pinia + Dexie
产品形态：Chrome Extension Side Panel
产品定位：Local-First 网页内容抓取、上下文预览、多模型 AI 阅读与知识管理工具

---

# 1. 产品概述

## 1.1 产品一句话说明

AuraMind 是一个运行在浏览器侧边栏中的本地优先 AI 阅读助手。用户可以在浏览任意网页时，手动或自动抓取当前页面正文，预览 Markdown / Raw 原文，将内容保存到本地知识库，并基于当前页面上下文调用多个自定义 AI 模型进行对话。

---

## 1.2 核心目标

1. **当前网页内容抓取**
   - 从当前页面提取正文、标题、URL、站点、元数据。
   - 支持手动刷新当前网页内容。
   - 支持页面切换后自动更新当前上下文状态。

2. **上下文预览**
   - 支持 Markdown 预览。
   - 支持 Raw 原始内容预览。
   - 支持元数据查看。
   - 支持复制 Markdown / Raw 内容。

3. **多模型 AI 对话**
   - 支持配置多个模型。
   - 每个模型支持独立系统提示词。
   - 每个模型支持独立 Base URL、API Key、上下文长度、温度等配置。
   - 支持切换当前使用模型。
   - 支持基于当前网页内容发起对话。

4. **Local-First 本地知识库**
   - 抓取内容、对话记录、模型配置、用户设置优先保存到本地。
   - 使用 IndexedDB 持久化。
   - 支持本地搜索。

5. **跨页面切换**
   - 用户切换浏览器 Tab 或当前页面 URL 变化后，侧边栏可以感知并刷新上下文。
   - 用户可以手动刷新当前网页抓取内容。
   - 用户可以从记忆库切换到历史文档，也可以回到当前浏览器页面。

---

# 2. 技术栈约定

## 2.1 已确认依赖

```json
{
  "dependencies": {
    "@lucide/vue": "^1.21.0",
    "dayjs": "^1.11.21",
    "defuddle": "^0.19.0",
    "dexie": "^4.4.4",
    "dompurify": "^3.4.11",
    "eventsource-parser": "^3.1.0",
    "highlight.js": "^11.11.1",
    "lz-string": "^1.5.0",
    "minisearch": "^7.2.0",
    "pinia": "^3.0.4",
    "pinia-plugin-persistedstate": "^4.7.1",
    "vue": "^3.5.29"
  },
  "devDependencies": {
    "@wxt-dev/module-vue": "^1.0.3",
    "@wxt-dev/unocss": "^1.0.1",
    "reka-ui": "^2.10.0",
    "typescript": "^5.9.3",
    "unocss": "^66.7.2",
    "vue-tsc": "^3.2.5",
    "wxt": "^0.20.27"
  }
}
```

---

## 2.2 技术分工

| 类别 | 技术 |
|---|---|
| 浏览器插件框架 | WXT |
| 前端框架 | Vue 3 |
| 语言 | TypeScript |
| UI 基础组件 | Reka UI |
| 图标 | @lucide/vue |
| 样式系统 | UnoCSS |
| 状态管理 | Pinia |
| 状态持久化 | pinia-plugin-persistedstate |
| 本地数据库 | Dexie / IndexedDB |
| 网页正文提取 | defuddle |
| HTML 安全清洗 | DOMPurify |
| 时间处理 | dayjs |
| 本地全文搜索 | MiniSearch |
| SSE 流式解析 | eventsource-parser |
| 代码高亮 | highlight.js |
| 内容压缩 | lz-string |

---

# 3. 产品信息架构

```txt
AuraMind
├── Workspace 工作区
│   ├── 当前页面状态
│   ├── Chat AI 对话
│   └── Context 上下文预览
│       ├── Markdown 预览
│       ├── Raw 原始内容
│       └── Metadata 元数据
│
├── Library 记忆库
│   ├── 搜索
│   ├── 最近捕获
│   ├── 文档列表
│   └── 文档详情跳转
│
└── Settings 设置
    ├── 模型池
    │   ├── 模型列表
    │   ├── 添加模型
    │   ├── 编辑模型
    │   ├── 每模型系统提示词
    │   └── 测试连接
    ├── 上下文设置
    ├── 抓取设置
    ├── 本地存储
    └── 数据导入导出
```

---

# 4. 页面级需求

---

# 4.1 App Shell

## 4.1.1 页面目标

App Shell 是侧边栏整体容器，负责：

1. 展示产品品牌。
2. 展示当前全局状态。
3. 提供一级页面切换。
4. 监听浏览器当前 Tab 变化。
5. 管理当前文档来源：
   - 当前浏览器页面
   - 记忆库历史文档

---

## 4.1.2 顶部导航

### UI 元素

- AuraMind Logo
- 当前状态副标题
- 一级入口：
  - Workspace
  - Library
  - Settings

### 状态副标题示例

| 当前页面 | 副标题 |
|---|---|
| Workspace | 当前网页上下文 |
| Library | 本地知识库 |
| Settings | 模型与配置 |
| 抓取中 | 正在解析当前页面 |
| 抓取失败 | 页面解析失败 |

---

## 4.1.3 页面切换规则

用户可以在以下页面间切换：

1. Workspace
2. Library
3. Settings

切换行为：

- 页面切换不应丢失当前聊天输入框内容。
- 页面切换不应重置当前文档。
- 页面切换不应中断正在进行的 AI 请求，除非用户主动取消。
- 从 Library 选择文档后，应自动跳转到 Workspace。
- 从 Settings 返回 Workspace 时，应保留当前文档和当前模型。

---

# 4.2 Workspace 工作区

## 4.2.1 页面目标

Workspace 是核心使用页面。

用户可以：

1. 查看当前浏览器页面的抓取状态。
2. 手动刷新当前网页抓取内容。
3. 切换 AI 对话和上下文预览。
4. 基于当前上下文向模型提问。
5. 切换当前使用模型。
6. 查看 Markdown、Raw 和 Metadata。

---

## 4.2.2 当前页面状态区

### UI 元素

- 当前文档标题
- 当前 URL 来源域名
- token 估算
- 抓取状态
- 手动刷新按钮
- 当前文档来源标识：
  - 当前浏览器页面
  - 本地历史文档

### 抓取状态

| 状态 | 说明 | UI |
|---|---|---|
| idle | 未开始抓取 | 灰色点 |
| extracting | 抓取中 | loading |
| ready | 已抓取 | 绿色点 |
| cached | 本地缓存命中 | 蓝色点 |
| failed | 抓取失败 | 红色点 |
| stale | 页面已变化，内容可能过期 | 黄色点 |

---

## 4.2.3 手动刷新当前页面

### 功能说明

用户点击刷新按钮后，系统重新抓取当前浏览器活动 Tab 的页面内容。

### 触发入口

- Workspace Header 的刷新按钮。
- 上下文视图中的“重新抓取”按钮。
- 抓取失败状态下的“重试”按钮。

### 刷新流程

```txt
用户点击刷新
↓
获取当前 active tab
↓
向 content script 请求页面内容
↓
defuddle 提取正文
↓
生成 markdown / raw / metadata
↓
计算 wordCount / tokenCount
↓
写入 IndexedDB
↓
更新当前文档状态
↓
刷新 UI
```

### 规则

1. 手动刷新只针对当前浏览器活动页面。
2. 如果当前 Workspace 正在展示历史文档，点击刷新时应提示：
   - “当前正在查看历史文档，是否切换到当前浏览器页面并重新抓取？”
3. 如果当前页面 URL 与当前文档 URL 一致，则直接覆盖更新该文档。
4. 如果 URL 不一致，则创建或加载对应 URL 的文档。
5. 刷新不会删除原有对话记录。
6. 刷新后文档 `updatedAt` 更新。
7. 如果抓取失败，保留旧内容，并展示错误提示。

---

## 4.2.4 浏览器页面切换支持

### 功能说明

当用户切换到其他浏览器 Tab 或当前 Tab URL 变化时，AuraMind 需要感知并更新当前页面状态。

### 监听场景

1. 用户切换浏览器 Tab。
2. 当前 Tab URL 发生变化。
3. 当前页面完成加载。
4. 用户在 SPA 页面内跳转。

### 技术实现建议

WXT background 中监听：

- `browser.tabs.onActivated`
- `browser.tabs.onUpdated`
- 必要时 content script 监听 history pushState / replaceState / popstate

### 行为规则

| 场景 | 行为 |
|---|---|
| 用户切换 Tab | Workspace 标记当前页面已变化 |
| 新页面已有本地缓存 | 加载缓存并显示 cached |
| 新页面无缓存 | 可自动抓取或显示“抓取当前页面”按钮 |
| 当前正在 AI 生成 | 不自动切换当前对话，提示页面已变化 |
| 用户正在查看历史文档 | 不强制切换，只在顶部提示“浏览器当前页面已变化” |
| 用户点击“切换到当前页面” | 加载当前 active tab 对应文档 |

---

## 4.2.5 Workspace 一级 Tab

Workspace 内部包含两个主 Tab：

1. 对话
2. 上下文

### 切换规则

- 对话和上下文互相切换。
- 切换到上下文时隐藏底部聊天输入区。
- 切换回对话时恢复输入区。
- 当前二级上下文 Tab 状态应保留。

---

# 4.3 Chat AI 对话

## 4.3.1 页面目标

用户可以基于当前文档内容向选定模型提问。

---

## 4.3.2 UI 元素

- 当前上下文挂载状态
- 当前模型选择器
- 消息列表
- 用户消息
- AI 消息
- 输入框
- 发送按钮
- 生成中状态
- 错误卡片
- 重新生成按钮
- 停止生成按钮，流式输出时使用

---

## 4.3.3 当前模型切换

### 功能

用户可以在聊天输入区或顶部模型选择器中切换当前模型。

### 规则

1. 只显示 enabled = true 的模型。
2. 默认选中 isDefault = true 的模型。
3. 用户切换模型后，仅影响之后的新消息。
4. 历史消息保留原 modelId。
5. 如果当前模型被禁用，自动切换到默认可用模型。
6. 如果没有可用模型，输入框禁用并提示去设置中添加模型。

---

## 4.3.4 发送消息

### 触发方式

- 点击发送按钮。
- Enter 发送。
- Shift + Enter 换行。

### 发送前校验

1. 当前是否有可用模型。
2. 当前模型配置是否合法。
3. 当前文档是否存在。
4. 用户输入是否为空。
5. API Key / Base URL 是否满足 provider 要求。
6. 当前是否已有请求进行中。

---

## 4.3.5 上下文注入规则

### 重要约束

上下文注入不需要固定写死“你是知识助手”之类的说明。

系统提示词来源应为：

1. 当前模型自定义系统提示词。
2. 如果模型没有配置，则使用全局默认系统提示词。
3. 如果全局也为空，则不注入 system prompt。

---

## 4.3.6 Prompt 组装规则

### Prompt 结构建议

```ts
{
  systemPrompt: model.systemPrompt || settings.globalSystemPrompt || '',
  context: buildContext(currentDocument, settings),
  messages: conversationMessages,
  userInput: input
}
```

### 上下文内容格式

上下文只描述事实内容，不添加固定角色设定。

示例：

```txt
<page_context>
<title>Local-First 软件设计原则</title>
<url>https://example.com/local-first</url>
<site>example.com</site>
<captured_at>2026-06-27T10:00:00Z</captured_at>
<content>
...当前网页 Markdown 内容...
</content>
</page_context>
```

也可以使用 Markdown 格式：

```txt
# Page Context

Title: Local-First 软件设计原则
URL: https://example.com/local-first
Captured At: 2026-06-27T10:00:00Z

---

...Markdown 内容...
```

### 规则

1. 不内置固定 AI 身份说明。
2. 不强制模型必须以某种口吻回答。
3. 是否要求“基于上下文回答”由用户或模型系统提示词决定。
4. 上下文应作为事实材料注入。
5. system prompt 与 page context 分离。
6. 支持关闭元数据注入。
7. 支持限制最大上下文 token。

---

## 4.3.7 流式输出

使用 `eventsource-parser` 解析 SSE。

### 支持 Provider

| Provider | 流式 |
|---|---|
| OpenAI Compatible | 支持 |
| Anthropic | 支持 |
| Ollama | 支持 |

### UI 行为

| 状态 | UI |
|---|---|
| sending | 发送中 |
| streaming | 逐字显示 |
| success | 完成 |
| failed | 错误卡片 |
| aborted | 已停止 |

### 停止生成

用户点击停止时：

1. 调用 AbortController。
2. 将当前 assistant message 状态标记为 aborted。
3. 保留已生成内容。
4. 允许重新生成。

---

## 4.3.8 对话保存

每次消息发送和模型响应后，应保存到 IndexedDB。

### 保存内容

- conversationId
- documentId
- modelId
- messages
- createdAt
- updatedAt

### 规则

1. 同一文档默认维护一个当前会话。
2. 后续可以支持多会话。
3. 消息中要记录生成时使用的模型 ID。
4. 失败消息也可以保存，但应标记 failed。

---

# 4.4 Context 上下文预览

## 4.4.1 页面目标

用户可以查看当前注入给模型的网页内容，确认 AI 实际使用的材料。

---

## 4.4.2 二级 Tab

1. Markdown 预览
2. Raw 原始内容
3. Metadata 元数据

---

## 4.4.3 Markdown 预览

### 功能

- 渲染抓取后的 Markdown。
- 支持标题、段落、列表、引用、代码块、表格。
- 使用 DOMPurify 做安全清洗。
- 使用 highlight.js 处理代码高亮。
- 支持复制 Markdown。
- 支持手动刷新。

### 验收标准

1. 不执行任何网页内脚本。
2. 长文滚动流畅。
3. 代码块可读。
4. Markdown 内容与 Raw 内容大体一致。
5. 刷新后内容更新。

---

## 4.4.4 Raw 原始内容

### 功能

Raw 用于展示抓取后的原始文本或 Markdown 源内容。

### 类型

| 类型 | 说明 |
|---|---|
| rawText | defuddle 提取出的纯文本 |
| rawMarkdown | 生成后的 Markdown 源码 |
| rawHtml | 清洗后的 HTML，可选保存 |

### UI 要求

- 深色背景。
- 等宽字体。
- 保留换行。
- 支持复制。
- 内容较长时滚动不卡顿。

---

## 4.4.5 Metadata 元数据

展示字段：

| 字段 | 说明 |
|---|---|
| title | 标题 |
| url | 页面 URL |
| canonicalUrl | 标准 URL |
| siteName | 站点 |
| author | 作者 |
| description | 页面描述 |
| publishedAt | 发布时间 |
| capturedAt | 首次抓取时间 |
| updatedAt | 最近刷新时间 |
| wordCount | 字数 |
| tokenCount | token 估算 |
| extractionMethod | 抓取方式 |
| contentHash | 内容 hash |
| source | 当前页面 / 历史文档 |
| localStatus | 本地保存状态 |

---

# 4.5 Library 记忆库

## 4.5.1 页面目标

用户可以浏览、搜索、打开本地保存的网页内容。

---

## 4.5.2 搜索

### 技术

使用 MiniSearch 实现本地全文搜索。

### 索引字段

- title
- url
- siteName
- markdown
- excerpt
- tags

### 搜索规则

1. 输入关键词后实时搜索。
2. 空关键词展示最近捕获。
3. 搜索结果按相关性排序。
4. 支持中文基础搜索。
5. 文档更新后应更新索引。
6. 文档删除后应从索引移除。

---

## 4.5.3 文档列表

### 展示字段

- 标题
- 来源域名
- 摘要
- 抓取时间
- 最近更新时间
- token 数
- 同步状态，预留
- 操作按钮：
  - 打开
  - 回到原网页
  - 删除

### 点击行为

点击文档：

1. 设置当前文档为该历史文档。
2. 跳转 Workspace。
3. Workspace 显示该文档内容。
4. Header 标记为“历史文档”。
5. 不自动覆盖为当前浏览器页面。

---

## 4.5.4 打开原网页

用户点击“打开原网页”：

1. 浏览器新 Tab 打开文档 URL。
2. Side Panel 可继续保留当前历史文档。
3. 如果用户切换到新 Tab，可提示“是否切换到当前页面上下文”。

---

## 4.5.5 删除文档

删除文档时：

1. 弹出确认框。
2. 删除 Document。
3. 删除关联 Conversation，或提示用户选择是否同时删除。
4. 更新 MiniSearch 索引。
5. 如果删除的是当前文档，应切换到当前浏览器页面或空状态。

---

# 4.6 Settings 设置

---

# 4.6.1 模型池

## 页面目标

用户可以配置、编辑、启用、禁用、测试多个模型。

---

## 4.6.2 模型字段

```ts
export interface ModelConfig {
  id: string;
  name: string;

  provider: 'openai-compatible' | 'anthropic' | 'ollama';
  modelId: string;

  baseUrl?: string;
  apiKey?: string;

  enabled: boolean;
  isDefault: boolean;

  contextWindow: number;
  temperature: number;

  systemPrompt?: string;

  createdAt: string;
  updatedAt: string;

  lastUsedAt?: string;
  lastTestStatus?: 'untested' | 'testing' | 'success' | 'failed';
  lastTestLatency?: number;
  lastTestError?: string;
}
```

---

## 4.6.3 每模型自定义系统提示词

### 功能说明

每个模型均可配置独立系统提示词。

### UI 入口

- 添加模型弹窗。
- 编辑模型弹窗。
- 模型卡片详情页。

### 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| systemPrompt | textarea | 当前模型专属 system prompt |

### 规则

1. 模型 systemPrompt 优先级高于全局 systemPrompt。
2. 如果模型 systemPrompt 为空，则使用全局 systemPrompt。
3. 如果全局也为空，则不发送 system role。
4. 切换模型后，后续请求使用新模型对应 systemPrompt。
5. 已生成历史消息不受影响。
6. systemPrompt 可以为空。
7. UI 不提供任何强制默认身份说明。

---

## 4.6.4 模型列表

每个模型卡片展示：

- 模型名称
- provider
- modelId
- baseUrl
- 是否默认
- 是否启用
- 测试状态
- 编辑按钮
- 删除按钮

---

## 4.6.5 添加模型

### 表单字段

| 字段 | 必填 | 说明 |
|---|---|---|
| name | 是 | 用户自定义名称 |
| provider | 是 | openai-compatible / anthropic / ollama |
| modelId | 是 | 模型 ID |
| baseUrl | 条件必填 | OpenAI Compatible / Ollama 需要 |
| apiKey | 条件必填 | Anthropic / OpenAI Compatible 通常需要 |
| contextWindow | 否 | 默认 32000 |
| temperature | 否 | 默认 0.7 |
| systemPrompt | 否 | 当前模型系统提示词 |
| enabled | 否 | 默认 true |
| isDefault | 否 | 默认 false |

### 校验规则

1. name 不可为空。
2. provider 必选。
3. modelId 不可为空。
4. baseUrl 如果填写，必须是合法 URL。
5. localhost URL 允许。
6. temperature 范围 0 到 2。
7. contextWindow 必须大于 0。
8. 如果设置为默认模型，则其他模型自动取消默认。
9. 如果是第一个模型，自动设为默认。

---

## 4.6.6 编辑模型

用户可以编辑：

- name
- modelId
- baseUrl
- apiKey
- contextWindow
- temperature
- systemPrompt
- enabled
- isDefault

规则：

1. 编辑后更新 `updatedAt`。
2. 如果禁用默认模型，需要用户选择新的默认模型。
3. 如果删除默认模型，需要用户选择新的默认模型。
4. 如果所有模型都被禁用，Chat 输入框不可用。

---

## 4.6.7 测试模型连接

### 测试逻辑

| Provider | 测试方式 |
|---|---|
| openai-compatible | `/chat/completions` 发送短消息 |
| anthropic | Messages API 发送短消息 |
| ollama | `/api/tags` 或 `/api/chat` |

### 测试结果

- success
- failed
- latency
- error message

### UI 状态

| 状态 | UI |
|---|---|
| untested | 灰色 |
| testing | loading |
| success | 绿色 |
| failed | 红色 |

---

# 4.7 上下文设置

## 4.7.1 配置项

```ts
export interface ContextSettings {
  maxContextTokens: number;
  includeMetadataInPrompt: boolean;
  includeUrlInPrompt: boolean;
  includeTitleInPrompt: boolean;
  includeCapturedAtInPrompt: boolean;
  includeConversationHistory: boolean;
  maxHistoryMessages: number;
}
```

---

## 4.7.2 默认值

| 配置 | 默认值 |
|---|---|
| maxContextTokens | 32000 |
| includeMetadataInPrompt | true |
| includeUrlInPrompt | true |
| includeTitleInPrompt | true |
| includeCapturedAtInPrompt | true |
| includeConversationHistory | true |
| maxHistoryMessages | 8 |

---

## 4.7.3 上下文截断规则

1. 优先保留 title、url、siteName、capturedAt。
2. markdown 内容按 token 估算截断。
3. 当前用户问题不参与截断。
4. 历史消息按最近优先保留。
5. 如果超过模型 contextWindow，应以模型 contextWindow 和全局 maxContextTokens 的较小值为准。

---

# 4.8 抓取设置

## 4.8.1 配置项

```ts
export interface CaptureSettings {
  autoExtractOnOpen: boolean;
  autoExtractOnTabChange: boolean;
  preferCache: boolean;
  saveRawHtml: boolean;
  compressRawHtml: boolean;
}
```

---

## 4.8.2 默认值

| 配置 | 默认 |
|---|---|
| autoExtractOnOpen | true |
| autoExtractOnTabChange | false |
| preferCache | true |
| saveRawHtml | false |
| compressRawHtml | true |

---

## 4.8.3 规则

1. autoExtractOnOpen 为 true 时，打开侧边栏自动抓取当前页面。
2. autoExtractOnTabChange 为 false 时，切换 Tab 只提示页面变化，不自动抓取。
3. preferCache 为 true 时，已有缓存优先加载缓存。
4. 用户点击手动刷新时，无视 preferCache，强制重新抓取。
5. saveRawHtml 为 true 时保存清洗后的 HTML。
6. compressRawHtml 为 true 时使用 lz-string 压缩 rawHtml。

---

# 4.9 本地存储

## 4.9.1 展示信息

- 文档数量
- 对话数量
- 模型数量
- IndexedDB 估算占用
- 搜索索引状态
- 最近更新时间

---

## 4.9.2 操作

- 导出 JSON
- 导入 JSON
- 重建搜索索引
- 清空本地数据

---

## 4.9.3 清空本地数据

必须二次确认。

确认文案：

```txt
此操作会删除所有本地文档、对话、模型配置和设置。该操作不可撤销。
```

---

# 5. Chrome Extension 架构

---

## 5.1 WXT 目录结构建议

```txt
src/
├── entrypoints/
│   ├── background.ts
│   ├── content.ts
│   └── sidepanel/
│       ├── index.html
│       ├── main.ts
│       └── App.vue
│
├── components/
│   ├── common/
│   ├── workspace/
│   ├── library/
│   └── settings/
│
├── stores/
│   ├── app.store.ts
│   ├── workspace.store.ts
│   ├── document.store.ts
│   ├── chat.store.ts
│   ├── model.store.ts
│   └── settings.store.ts
│
├── db/
│   ├── index.ts
│   ├── schema.ts
│   └── repositories/
│
├── services/
│   ├── capture/
│   ├── ai/
│   ├── search/
│   ├── prompt/
│   ├── storage/
│   └── messaging/
│
├── types/
│   ├── document.ts
│   ├── chat.ts
│   ├── model.ts
│   ├── settings.ts
│   └── message.ts
│
├── utils/
│   ├── token.ts
│   ├── hash.ts
│   ├── date.ts
│   ├── sanitize.ts
│   └── compress.ts
│
└── uno.config.ts
```

---

## 5.2 Manifest 权限

建议权限：

```json
{
  "permissions": [
    "sidePanel",
    "activeTab",
    "scripting",
    "storage",
    "tabs"
  ],
  "host_permissions": [
    "<all_urls>"
  ]
}
```

说明：

1. `activeTab` 用于读取当前页面。
2. `tabs` 用于感知页面切换。
3. `sidePanel` 用于 Chrome 侧边栏。
4. `<all_urls>` 用于 content script 抓取和自定义模型 API 请求。

---

## 5.3 Background 职责

background 负责：

1. Side Panel 生命周期管理。
2. 当前 active tab 状态监听。
3. tab 切换事件广播。
4. tab URL 更新事件广播。
5. 与 content script 通信。
6. 必要时代理跨域 AI 请求。

---

## 5.4 Content Script 职责

content script 负责：

1. 获取当前页面 HTML。
2. 调用 defuddle 提取正文。
3. 提取 metadata。
4. 监听 SPA URL 变化。
5. 返回 ExtractedPage 给 sidepanel。

---

## 5.5 Side Panel 职责

sidepanel 负责：

1. UI 渲染。
2. 状态管理。
3. IndexedDB 操作。
4. AI 请求。
5. 搜索索引。
6. 用户设置管理。

---

# 6. 数据模型

---

## 6.1 DocumentEntity

```ts
export interface DocumentEntity {
  id: string;

  url: string;
  canonicalUrl?: string;

  title: string;
  siteName?: string;
  author?: string;
  description?: string;
  publishedAt?: string;

  markdown: string;
  rawText?: string;
  rawHtml?: string;
  rawHtmlCompressed?: boolean;

  excerpt?: string;
  wordCount: number;
  tokenCount: number;
  contentHash: string;

  extractionMethod: 'defuddle' | 'fallback' | 'manual';
  source: 'current-page' | 'library';

  capturedAt: string;
  updatedAt: string;
  lastOpenedAt?: string;

  tags?: string[];

  syncStatus?: 'local-only' | 'synced' | 'pending' | 'conflict';
}
```

---

## 6.2 ConversationEntity

```ts
export interface ConversationEntity {
  id: string;
  documentId: string;

  title?: string;
  messages: ChatMessage[];

  createdAt: string;
  updatedAt: string;
}
```

---

## 6.3 ChatMessage

```ts
export interface ChatMessage {
  id: string;

  role: 'user' | 'assistant' | 'system';
  content: string;

  modelId?: string;

  status?: 'pending' | 'sending' | 'streaming' | 'success' | 'failed' | 'aborted';

  createdAt: string;
  updatedAt?: string;

  error?: string;

  tokenUsage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}
```

---

## 6.4 ModelConfig

```ts
export interface ModelConfig {
  id: string;
  name: string;

  provider: 'openai-compatible' | 'anthropic' | 'ollama';
  modelId: string;

  baseUrl?: string;
  apiKey?: string;

  enabled: boolean;
  isDefault: boolean;

  contextWindow: number;
  temperature: number;

  systemPrompt?: string;

  createdAt: string;
  updatedAt: string;

  lastUsedAt?: string;

  lastTestStatus?: 'untested' | 'testing' | 'success' | 'failed';
  lastTestLatency?: number;
  lastTestError?: string;
}
```

---

## 6.5 AppSettings

```ts
export interface AppSettings {
  id: 'app-settings';

  globalSystemPrompt?: string;

  context: ContextSettings;
  capture: CaptureSettings;

  createdAt: string;
  updatedAt: string;
}
```

---

## 6.6 ContextSettings

```ts
export interface ContextSettings {
  maxContextTokens: number;

  includeMetadataInPrompt: boolean;
  includeUrlInPrompt: boolean;
  includeTitleInPrompt: boolean;
  includeCapturedAtInPrompt: boolean;

  includeConversationHistory: boolean;
  maxHistoryMessages: number;
}
```

---

## 6.7 CaptureSettings

```ts
export interface CaptureSettings {
  autoExtractOnOpen: boolean;
  autoExtractOnTabChange: boolean;
  preferCache: boolean;

  saveRawHtml: boolean;
  compressRawHtml: boolean;
}
```

---

# 7. Dexie 数据库设计

```ts
db.version(1).stores({
  documents: 'id, url, canonicalUrl, title, siteName, capturedAt, updatedAt, lastOpenedAt, contentHash',
  conversations: 'id, documentId, createdAt, updatedAt',
  models: 'id, provider, modelId, enabled, isDefault, updatedAt, lastUsedAt',
  settings: 'id, updatedAt'
});
```

---

# 8. Pinia Store 设计

---

## 8.1 app.store.ts

负责：

- 当前一级页面
- 全局 loading
- 全局 toast
- 当前 activeTab 信息
- 页面变化提示

---

## 8.2 workspace.store.ts

负责：

- workspace 当前 Tab
- context 当前 Tab
- 当前文档来源
- 抓取状态
- 是否展示页面变化提示

---

## 8.3 document.store.ts

负责：

- 当前文档
- 当前浏览器页面文档
- 历史文档加载
- 手动刷新
- 文档保存
- 文档删除

---

## 8.4 chat.store.ts

负责：

- 当前 conversation
- 当前输入内容
- 发送消息
- 流式状态
- 停止生成
- 重新生成

---

## 8.5 model.store.ts

负责：

- 模型列表
- 当前模型
- 默认模型
- 添加模型
- 编辑模型
- 删除模型
- 测试连接

---

## 8.6 settings.store.ts

负责：

- globalSystemPrompt
- context settings
- capture settings
- 本地持久化设置

---

# 9. AI Provider 适配层

---

## 9.1 统一接口

```ts
export interface AIProvider {
  chat(input: ChatInput): Promise<ChatOutput>;
  streamChat(input: ChatInput, callbacks: StreamCallbacks): Promise<void>;
  testConnection(config: ModelConfig): Promise<TestConnectionResult>;
}
```

```ts
export interface ChatInput {
  model: ModelConfig;
  systemPrompt?: string;
  context?: string;
  messages: {
    role: 'user' | 'assistant' | 'system';
    content: string;
  }[];
  signal?: AbortSignal;
}
```

```ts
export interface StreamCallbacks {
  onToken: (text: string) => void;
  onDone: () => void;
  onError: (error: Error) => void;
}
```

---

## 9.2 Provider 实现

需要实现：

1. OpenAICompatibleProvider
2. AnthropicProvider
3. OllamaProvider

---

## 9.3 System Prompt 处理规则

```ts
function resolveSystemPrompt(model: ModelConfig, settings: AppSettings): string | undefined {
  return model.systemPrompt?.trim()
    || settings.globalSystemPrompt?.trim()
    || undefined;
}
```

如果返回 `undefined`：

- OpenAI Compatible：不发送 system message。
- Anthropic：不传 system 字段。
- Ollama：不发送 system role。

---

# 10. Prompt Builder

---

## 10.1 输入

```ts
interface BuildPromptInput {
  document: DocumentEntity;
  conversation: ConversationEntity;
  model: ModelConfig;
  settings: AppSettings;
  userInput: string;
}
```

---

## 10.2 输出

```ts
interface BuiltPrompt {
  systemPrompt?: string;
  contextText: string;
  messages: {
    role: 'user' | 'assistant' | 'system';
    content: string;
  }[];
}
```

---

## 10.3 构造规则

1. systemPrompt 来自模型或全局设置。
2. contextText 只包含页面事实内容。
3. 不写死 AI 身份。
4. 不写死回答风格。
5. 不写死“必须基于上下文回答”。
6. 用户如果需要这些约束，应写入模型 systemPrompt 或全局 systemPrompt。
7. 历史消息按照设置裁剪。
8. markdown 按 token 限制裁剪。

---

# 11. 网页抓取服务

---

## 11.1 ExtractedPage

```ts
export interface ExtractedPage {
  url: string;
  canonicalUrl?: string;

  title: string;
  siteName?: string;
  author?: string;
  description?: string;
  publishedAt?: string;

  markdown: string;
  rawText?: string;
  rawHtml?: string;

  excerpt?: string;
  wordCount: number;
  tokenCount: number;

  extractionMethod: 'defuddle' | 'fallback';

  contentHash: string;
}
```

---

## 11.2 defuddle 抓取流程

```txt
content script
↓
读取 document HTML
↓
defuddle 提取正文与元数据
↓
DOMPurify 清洗 HTML
↓
生成 markdown/rawText
↓
计算 hash/token/wordCount
↓
返回 sidepanel
```

---

## 11.3 fallback 规则

当 defuddle 失败：

1. 使用 document.title。
2. 使用 document.body.innerText。
3. 过滤明显空行。
4. 标记 extractionMethod = fallback。
5. UI 显示“已使用备用文本提取”。

---

# 12. 本地搜索服务

---

## 12.1 MiniSearch 配置

```ts
const miniSearch = new MiniSearch({
  fields: ['title', 'url', 'siteName', 'markdown', 'excerpt'],
  storeFields: ['id', 'title', 'url', 'siteName', 'excerpt', 'capturedAt', 'updatedAt'],
  searchOptions: {
    boost: {
      title: 3,
      siteName: 2,
      markdown: 1
    },
    fuzzy: 0.2,
    prefix: true
  }
});
```

---

## 12.2 索引更新规则

| 动作 | 行为 |
|---|---|
| 新增文档 | add |
| 更新文档 | replace |
| 删除文档 | remove |
| 导入数据 | rebuild |
| 清空数据 | clear |

---

# 13. 组件拆分建议

```txt
components/
├── common/
│   ├── AppShell.vue
│   ├── TopBar.vue
│   ├── IconButton.vue
│   ├── SegmentedControl.vue
│   ├── StatusBadge.vue
│   ├── ConfirmDialog.vue
│   ├── EmptyState.vue
│   ├── ErrorCard.vue
│   └── Toast.vue
│
├── workspace/
│   ├── WorkspaceView.vue
│   ├── WorkspaceHeader.vue
│   ├── PageStatusBar.vue
│   ├── ChatPanel.vue
│   ├── ChatMessage.vue
│   ├── ChatInput.vue
│   ├── ModelSelect.vue
│   ├── ContextPanel.vue
│   ├── MarkdownPreview.vue
│   ├── RawPreview.vue
│   └── MetadataPanel.vue
│
├── library/
│   ├── LibraryView.vue
│   ├── SearchBar.vue
│   ├── DocumentList.vue
│   ├── DocumentItem.vue
│   └── DeleteDocumentDialog.vue
│
└── settings/
    ├── SettingsView.vue
    ├── ModelPool.vue
    ├── ModelCard.vue
    ├── ModelEditorDialog.vue
    ├── ContextSettings.vue
    ├── CaptureSettings.vue
    └── StorageSettings.vue
```

---

# 14. 关键验收标准

| 模块 | 验收标准 |
|---|---|
| 插件壳 | 能通过 WXT 构建并在 Chrome 加载 |
| Side Panel | 能打开并正常展示三个一级页面 |
| 页面切换 | Workspace / Library / Settings 切换不丢状态 |
| 当前页面识别 | 能识别 active tab URL 和标题 |
| 页面变化 | 切换浏览器 Tab 后能提示当前页面变化 |
| 手动刷新 | 点击刷新能重新抓取当前页面 |
| 内容抓取 | 能使用 defuddle 提取主流文章页正文 |
| fallback | 抓取失败时能使用 body.innerText |
| Markdown 预览 | 内容安全渲染，不执行脚本 |
| Raw 预览 | 能查看原始文本 |
| Metadata | 展示 URL、标题、时间、token 等信息 |
| 多模型 | 可添加、编辑、删除、启用、禁用模型 |
| 模型系统提示词 | 每个模型可独立配置 systemPrompt |
| Prompt 注入 | 不写死固定 AI 身份说明 |
| 模型切换 | Chat 中可切换当前模型 |
| AI 对话 | 能基于当前上下文发送请求并返回结果 |
| 流式输出 | 支持逐步显示生成内容 |
| 停止生成 | 可中断请求并保留已生成内容 |
| 本地存储 | 文档、对话、模型、设置刷新后不丢失 |
| 本地搜索 | 能搜索本地文档 |
| 删除文档 | 删除前二次确认 |
| 清空数据 | 清空前二次确认 |

---

# 15. 研发里程碑

## Phase 1：插件基础与 UI 框架

交付：

- WXT + Vue 工程初始化。
- UnoCSS 配置。
- Reka UI 接入。
- Side Panel 页面。
- AppShell。
- 三个一级页面切换。
- Pinia 基础 store。
- Dexie 初始化。

验收：

- 插件可安装。
- 侧边栏可打开。
- Workspace / Library / Settings 可切换。
- 页面切换不报错。

---

## Phase 2：网页抓取与上下文预览

交付：

- content script。
- background 与 sidepanel 通信。
- defuddle 抽取。
- fallback 抽取。
- DocumentEntity 入库。
- Markdown 预览。
- Raw 预览。
- Metadata 展示。
- 手动刷新。
- 浏览器 Tab 切换感知。

验收：

- 打开网页后能抓取正文。
- 点击刷新能重新抓取。
- 切换浏览器页面后能提示页面变化。
- 已抓取内容刷新插件后仍存在。

---

## Phase 3：模型配置与 Prompt Builder

交付：

- 模型池页面。
- 添加模型。
- 编辑模型。
- 删除模型。
- 启用 / 禁用模型。
- 默认模型。
- 每模型 systemPrompt。
- 全局 systemPrompt。
- Prompt Builder。
- OpenAI Compatible / Anthropic / Ollama 适配器基础实现。
- 模型测试连接。

验收：

- 可以创建多个模型。
- 每个模型可以配置不同 systemPrompt。
- 切换模型后使用对应系统提示词。
- 如果 systemPrompt 为空，不注入固定身份说明。
- 测试连接能显示成功或失败。

---

## Phase 4：AI 对话与流式输出

交付：

- Chat UI。
- 模型选择器。
- 发送消息。
- 流式输出。
- 停止生成。
- 重新生成。
- 对话保存。
- 错误处理。

验收：

- 用户可以基于当前文档提问。
- AI 返回内容能流式展示。
- 停止生成有效。
- 对话刷新后仍存在。
- API 错误有明确提示。

---

## Phase 5：记忆库与搜索

交付：

- 文档列表。
- MiniSearch 索引。
- 搜索框。
- 搜索结果。
- 打开历史文档。
- 打开原网页。
- 删除文档。
- 重建索引。

验收：

- 能看到历史文档。
- 能搜索标题、URL、正文。
- 点击历史文档跳转 Workspace。
- 删除后列表和索引同步更新。

---

## Phase 6：存储管理与导入导出

交付：

- 本地存储统计。
- 导出 JSON。
- 导入 JSON。
- 清空本地数据。
- 重建搜索索引。

验收：

- 能导出完整本地数据。
- 能导入并恢复文档和模型。
- 清空数据必须二次确认。

---

# 16. 开发注意事项

## 16.1 不要硬编码默认系统身份

不得在代码中固定拼接：

```txt
你是 AuraMind，一个知识助手……
```

或类似角色说明。

系统提示词必须来自：

1. 模型配置。
2. 全局配置。
3. 为空则不传。

---

## 16.2 上下文是材料，不是角色设定

正确做法：

```txt
Title: xxx
URL: xxx

Content:
...
```

错误做法：

```txt
你必须作为一个知识助手，根据以下内容回答……
```

---

## 16.3 页面切换不要强制覆盖用户当前工作区

当浏览器 Tab 变化时：

- 不应立即清空当前文档。
- 不应打断当前 AI 对话。
- 应提示用户当前浏览器页面已变化。
- 用户确认后再切换到新页面上下文。

---

## 16.4 手动刷新优先级最高

用户点击刷新时，应强制重新抓取当前页面，而不是直接使用缓存。

---

## 16.5 模型配置要可迁移

模型数据应完整保存在 IndexedDB，导出 JSON 时包含模型配置。

注意：

- API Key 属于敏感数据。
- 导出时应提示用户导出文件包含密钥。
- 后续可支持导出时排除密钥。

---

# 17. 最终成功标准

当以下流程完整可用，即认为本版本研发完成：

1. 用户安装插件。
2. 打开任意网页。
3. 打开 AuraMind 侧边栏。
4. 系统识别当前网页。
5. 用户点击刷新或自动抓取当前网页。
6. 用户查看 Markdown 预览。
7. 用户查看 Raw 原始内容。
8. 用户查看 Metadata。
9. 用户添加多个模型。
10. 用户为不同模型配置不同 systemPrompt。
11. 用户在 Chat 中切换模型。
12. 用户基于当前网页提问。
13. AI 返回流式结果。
14. 用户切换浏览器 Tab 后，AuraMind 提示页面变化。
15. 用户手动切换到当前页面并刷新抓取。
16. 用户在记忆库中搜索历史文档。
17. 用户打开历史文档继续对话。
18. 用户导出或清空本地数据。
