下面是一版 **ReadChat Chrome Extension MV3 详细技术架构图**，按你定义的 4 层架构展开，并补充核心数据流、AI 流式对话、WebDAV 同步、本地检索 Worker 的技术路径。

---

# 1. 总体技术架构图

```mermaid
flowchart TB
  User[用户] --> Browser[Chrome 浏览器]

  Browser --> ContentScript[Content Script<br/>网页 DOM 访问层]
  Browser --> SidePanel[Side Panel UI<br/>沉浸式侧边栏]
  Browser --> Popup[Popup / Floating Button<br/>快捷入口]
  Browser --> Background[MV3 Service Worker<br/>后台调度中心]

  subgraph Perception[捕获层 Perception]
    ContentScript --> DOMReader[DOM 快照读取]
    DOMReader --> Readability[@mozilla/readability<br/>正文抽取]
    Readability --> Turndown[Turndown<br/>HTML to Markdown]
    DOMReader --> MetadataExtractor[元数据提取引擎<br/>Title / URL / Author / Date / SEO / Favicon]
    Turndown --> CaptureResult[标准化捕获结果<br/>Markdown + Metadata]
    MetadataExtractor --> CaptureResult
  end

  subgraph Thinking[处理层 Thinking]
    SidePanel --> ChatUI[Chat with Doc UI]
    ChatUI --> PromptBuilder[Prompt 构建器<br/>System Prompt + Doc Context + User Question]
    PromptBuilder --> ModelRouter[多模型路由器]
    ModelRouter --> OpenAI[OpenAI Adapter]
    ModelRouter --> Anthropic[Anthropic Adapter]
    ModelRouter --> Gemini[Gemini Adapter]
    OpenAI --> StreamParser[SSE / Fetch Stream Parser]
    Anthropic --> StreamParser
    Gemini --> StreamParser
    StreamParser --> MarkdownRenderer[Markdown 渲染<br/>代码高亮 / 公式]
    MarkdownRenderer --> ChatUI
  end

  subgraph Persistence[记忆层 Persistence]
    Dexie[Dexie.js]
    IndexedDB[(IndexedDB)]
    Documents[(documents)]
    ChatHistories[(chatHistories)]
    Settings[(settings)]
    Dexie --> IndexedDB
    IndexedDB --> Documents
    IndexedDB --> ChatHistories
    IndexedDB --> Settings

    Exporter[手动导出器<br/>ReadChat_backup.json]
    BackupPackager[整包备份打包器<br/>ReadChat_data.json]
    Compressor[压缩模块<br/>Gzip / Zip]
    WebDAVClient[WebDAV Client<br/>PUT / GET / PROPFIND]
    RemoteWebDAV[(WebDAV Server<br/>坚果云 / Nextcloud / NAS)]

    Dexie --> Exporter
    Dexie --> BackupPackager
    BackupPackager --> Compressor
    Compressor --> WebDAVClient
    WebDAVClient --> RemoteWebDAV
  end

  subgraph Awakening[唤醒层 Awakening]
    SearchWorker[Web Worker<br/>MiniSearch Index Worker]
    MiniSearch[MiniSearch Index<br/>title 权重 3<br/>markdownContent 权重 1]
    SearchAPI[Search API]
    Timeline[Timeline Aggregator<br/>day / week / month]
    TimelineUI[历史时间轴 UI<br/>Contribution Graph]

    Documents --> SearchWorker
    SearchWorker --> MiniSearch
    SidePanel --> SearchAPI
    SearchAPI --> MiniSearch

    Documents --> Timeline
    Timeline --> TimelineUI
    TimelineUI --> SidePanel
  end

  CaptureResult --> Background
  Background --> Dexie
  Dexie --> SidePanel
  Popup --> Background
  Background --> SidePanel
```

---

# 2. Chrome Extension 运行时架构

```mermaid
flowchart LR
  subgraph Page[网页上下文]
    DOM[当前网页 DOM]
    PageMeta[Meta / JSON-LD / Schema.org]
  end

  subgraph Extension[Chrome Extension MV3]
    ContentScript[content-script.ts<br/>读取 DOM / 注入悬浮按钮]
    Background[background.ts<br/>Service Worker]
    SidePanel[sidepanel.tsx<br/>主交互界面]
    Options[options.tsx<br/>模型与同步配置]
    Worker[search.worker.ts<br/>MiniSearch 索引]
  end

  subgraph Storage[本地存储]
    IndexedDB[(IndexedDB via Dexie)]
    ChromeStorage[(chrome.storage.local)]
  end

  subgraph External[外部服务]
    LLM[LLM APIs<br/>OpenAI / Anthropic / Gemini]
    WebDAV[WebDAV Server]
  end

  DOM --> ContentScript
  PageMeta --> ContentScript

  ContentScript <--> Background
  SidePanel <--> Background
  Options <--> Background

  Background <--> IndexedDB
  Background <--> ChromeStorage

  SidePanel <--> IndexedDB
  SidePanel <--> Worker
  Worker <--> IndexedDB

  Background <--> LLM
  Background <--> WebDAV
```

## 关键职责划分

- `content-script.ts`
  - 访问当前页面 DOM
  - 执行 Readability 解析
  - 提取 metadata
  - 触发捕获事件
  - 可注入悬浮按钮

- `background.ts`
  - MV3 Service Worker 调度中心
  - 负责跨上下文通信
  - 调用 LLM API
  - 执行 WebDAV 同步
  - 处理右键菜单、快捷键、side panel 打开

- `sidepanel.tsx`
  - Chat with Doc 主界面
  - 展示当前文档
  - 展示 AI 流式回复
  - 搜索入口
  - 时间轴入口

- `options.tsx`
  - 模型配置
  - API Key 管理
  - Base URL 配置
  - WebDAV 配置
  - 系统提示词配置

- `search.worker.ts`
  - MiniSearch 索引构建
  - 异步增量更新
  - 全文检索响应

---

# 3. 捕获层数据流

```mermaid
sequenceDiagram
  participant U as 用户
  participant CS as Content Script
  participant BG as Background Service Worker
  participant DB as Dexie / IndexedDB
  participant SW as Search Worker
  participant UI as Side Panel

  U->>CS: 点击悬浮按钮 / 快捷键捕获
  CS->>CS: clone 当前 document
  CS->>CS: Readability.parse()
  CS->>CS: Turndown 转 Markdown
  CS->>CS: 提取 Title / URL / Author / Date / SEO / Favicon
  CS->>BG: sendMessage CAPTURE_PAGE
  BG->>DB: documents.put(document)
  DB-->>BG: 返回 documentId
  BG->>SW: 通知索引更新
  SW->>DB: 读取新 document
  SW->>SW: MiniSearch.add()
  BG->>UI: 打开 Side Panel 并传入 documentId
  UI->>DB: 读取当前文档
  UI-->>U: 展示 Markdown / 摘要 / 对话入口
```

## 捕获结果结构

```ts
interface CapturedDocument {
  id: string;
  title: string;
  url: string;
  author?: string;
  publishedAt?: string;
  favicon?: string;
  description?: string;
  keywords?: string[];
  markdownContent: string;
  rawHtml?: string;
  siteName?: string;
  createdAt: number;
  updatedAt: number;
}
```

---

# 4. Thinking 层：多模型与流式对话架构

```mermaid
flowchart TB
  ChatInput[用户问题] --> PromptBuilder[Prompt Builder]

  CurrentDoc[当前文档 Markdown] --> ContextManager[Context Manager]
  SystemPrompt[用户配置的系统提示词] --> PromptBuilder
  ContextManager --> PromptBuilder

  PromptBuilder --> ModelSelector[Model Selector<br/>选择默认启用模型]
  ModelSelector --> ModelRouter[Model Router]

  subgraph Adapters[LLM Provider Adapters]
    OpenAIAdapter[OpenAI Adapter<br/>Chat Completions / Responses API]
    AnthropicAdapter[Anthropic Adapter<br/>Messages API]
    GeminiAdapter[Gemini Adapter<br/>Generate Content API]
  end

  ModelRouter --> OpenAIAdapter
  ModelRouter --> AnthropicAdapter
  ModelRouter --> GeminiAdapter

  OpenAIAdapter --> StreamNormalizer[Stream Normalizer<br/>统一 delta 格式]
  AnthropicAdapter --> StreamNormalizer
  GeminiAdapter --> StreamNormalizer

  StreamNormalizer --> ChatState[Chat State]
  ChatState --> MarkdownView[Markdown Renderer]
  MarkdownView --> SidePanel[Side Panel UI]

  ChatState --> ChatHistoryStore[chatHistories 表]
```

## 统一流式输出格式

不同模型的 SSE chunk 格式不一致，建议统一归一化：

```ts
interface StreamDelta {
  type: 'text' | 'reasoning' | 'tool' | 'done' | 'error';
  content?: string;
  error?: string;
}
```

## 模型配置结构

```ts
interface ModelProviderConfig {
  id: string;
  name: string;
  provider: 'openai' | 'anthropic' | 'gemini';
  enabled: boolean;
  apiKey: string;
  baseUrl?: string;
  model: string;
  systemPrompt?: string;
  createdAt: number;
  updatedAt: number;
}
```

---

# 5. Chat with Doc 流式对话时序图

```mermaid
sequenceDiagram
  participant U as 用户
  participant UI as Side Panel
  participant DB as IndexedDB
  participant BG as Background
  participant MR as Model Router
  participant LLM as LLM API
  participant CH as chatHistories

  U->>UI: 输入问题
  UI->>DB: 读取当前 document markdown
  DB-->>UI: 返回文档内容
  UI->>UI: 构建用户消息
  UI->>BG: startChatStream(documentId, question)
  BG->>DB: 读取模型配置和系统提示词
  BG->>MR: 选择启用模型
  MR->>LLM: 发起 stream 请求

  loop Streaming
    LLM-->>MR: SSE / chunk delta
    MR-->>BG: 标准化 StreamDelta
    BG-->>UI: 转发 delta
    UI-->>UI: 追加渲染 Markdown
  end

  LLM-->>MR: done
  MR-->>BG: done
  BG->>CH: 保存完整问答记录
  BG-->>UI: stream finished
```

---

# 6. 记忆层：IndexedDB 数据模型

```mermaid
erDiagram
  documents {
    string id PK
    string title
    string url
    string author
    string publishedAt
    string favicon
    string description
    string markdownContent
    string rawHtml
    number createdAt
    number updatedAt
  }

  chatHistories {
    string id PK
    string documentId FK
    string provider
    string model
    array messages
    number createdAt
    number updatedAt
  }

  settings {
    string key PK
    object value
    number updatedAt
  }

  documents ||--o{ chatHistories : has
```

## Dexie 表建议

```ts
db.version(1).stores({
  documents: 'id, url, title, createdAt, updatedAt',
  chatHistories: 'id, documentId, createdAt, updatedAt',
  settings: 'key, updatedAt'
});
```

---

# 7. WebDAV 整包同步架构

```mermaid
flowchart TB
  subgraph Local[本地]
    DB[(IndexedDB)]
    Snapshot[同步前本地快照]
    Packager[Backup Packager]
    DataJSON[ReadChat_data.json]
    MetadataLocal[metadata.json<br/>updatedAt]
    Compressor[Compression<br/>Gzip / Zip]
  end

  subgraph Remote[WebDAV 远端]
    RemoteDir[/ReadChat_Backup/]
    RemoteData[ReadChat_data.json.gz]
    RemoteMeta[metadata.json]
  end

  DB --> Snapshot
  DB --> Packager
  Packager --> DataJSON
  Packager --> MetadataLocal
  DataJSON --> Compressor
  Compressor --> RemoteData
  MetadataLocal --> RemoteMeta

  RemoteDir --> RemoteData
  RemoteDir --> RemoteMeta
```

## 上传流程

```mermaid
sequenceDiagram
  participant U as 用户
  participant UI as Side Panel / Options
  participant BG as Background
  participant DB as IndexedDB
  participant WD as WebDAV Server

  U->>UI: 点击上传云端
  UI->>BG: syncUpload()
  BG->>DB: 读取 documents / chatHistories / settings
  BG->>BG: 生成本地快照
  BG->>BG: 打包 ReadChat_data.json
  BG->>BG: 生成 metadata.json(updatedAt)
  BG->>BG: 压缩数据包
  BG->>WD: MKCOL /ReadChat_Backup/
  BG->>WD: PUT ReadChat_data.json.gz
  BG->>WD: PUT metadata.json
  WD-->>BG: 200 / 201 / 204
  BG-->>UI: 同步成功
```

## 拉取流程

```mermaid
sequenceDiagram
  participant U as 用户
  participant UI as Side Panel / Options
  participant BG as Background
  participant DB as IndexedDB
  participant WD as WebDAV Server

  U->>UI: 点击拉取云端
  UI->>BG: syncDownload()
  BG->>WD: GET metadata.json
  WD-->>BG: remote updatedAt
  BG->>DB: 读取本地 settings.lastSyncAt

  alt remote.updatedAt > local.updatedAt
    BG->>DB: 保存同步前快照
    BG->>WD: GET ReadChat_data.json.gz
    BG->>BG: 解压并校验 schema
    BG->>DB: clear documents / chatHistories / settings
    BG->>DB: bulkPut 远端数据
    BG->>DB: 更新 lastSyncAt
    BG-->>UI: 拉取并覆盖成功
  else remote.updatedAt <= local.updatedAt
    BG-->>UI: 本地已是最新
  end
```

## 压缩说明

你写的是“JSZip 进行 Gzip 压缩”，这里建议稍微区分：

- 如果要生成 `.zip`：使用 `JSZip`
- 如果要生成 `.gz`：使用 `CompressionStream('gzip')` 或 `pako`
- 如果目标是“单文件整包备份”，两者都可以，推荐命名保持一致：
  - `ReadChat_data.json.gz`
  - 或 `ReadChat_backup.zip`

---

# 8. Awakening 层：MiniSearch 本地检索架构

```mermaid
flowchart TB
  Documents[(documents 表)] --> ChangeNotifier[Document Change Notifier]
  ChangeNotifier --> SearchWorker[search.worker.ts]

  SearchWorker --> LoadDocs[读取新增 / 更新文档]
  LoadDocs --> Normalize[文本清洗与字段标准化]
  Normalize --> MiniSearchIndex[MiniSearch Index]

  MiniSearchIndex --> SearchQuery[search(query)]
  SearchQuery --> Ranking[字段权重排序<br/>title x3<br/>markdownContent x1]
  Ranking --> SearchResult[SearchResult[]]

  SidePanel[Side Panel Search UI] --> SearchQuery
  SearchResult --> SidePanel
```

## Worker 消息协议

```ts
type SearchWorkerRequest =
  | { type: 'INIT_INDEX' }
  | { type: 'UPSERT_DOCUMENT'; documentId: string }
  | { type: 'REMOVE_DOCUMENT'; documentId: string }
  | { type: 'SEARCH'; query: string; requestId: string };

type SearchWorkerResponse =
  | { type: 'INDEX_READY' }
  | { type: 'SEARCH_RESULT'; requestId: string; results: SearchResult[] }
  | { type: 'ERROR'; message: string };
```

## MiniSearch 配置建议

```ts
const miniSearch = new MiniSearch({
  fields: ['title', 'markdownContent'],
  storeFields: ['id', 'title', 'url', 'createdAt'],
  searchOptions: {
    boost: {
      title: 3,
      markdownContent: 1
    },
    fuzzy: 0.2,
    prefix: true
  }
});
```

---

# 9. 时间轴 Timeline 架构

```mermaid
flowchart TB
  Documents[(documents 表)] --> TimelineAggregator[Timeline Aggregator]

  TimelineAggregator --> DayBucket[按天聚合]
  TimelineAggregator --> WeekBucket[按周聚合]
  TimelineAggregator --> MonthBucket[按月聚合]

  DayBucket --> TimelineData[Timeline Data]
  WeekBucket --> TimelineData
  MonthBucket --> TimelineData

  TimelineData --> ContributionGraph[Contribution Graph UI]
  ContributionGraph --> DateClick[点击某一天]
  DateClick --> DocumentList[当天文档列表]
```

## 聚合结果结构

```ts
interface TimelineBucket {
  date: string;
  count: number;
  documentIds: string[];
}

interface TimelineQuery {
  mode: 'day' | 'week' | 'month';
  startAt: number;
  endAt: number;
}
```

---

# 10. 模块依赖关系图

```mermaid
flowchart TB
  UI[UI Layer<br/>Side Panel / Options / Popup]
  App[Application Layer<br/>Capture / Chat / Sync / Search]
  Domain[Domain Layer<br/>Document / Chat / Settings / Backup]
  Infra[Infrastructure Layer<br/>Dexie / WebDAV / LLM / MiniSearch]
  External[External Systems<br/>Web Page / LLM API / WebDAV]

  UI --> App
  App --> Domain
  App --> Infra
  Infra --> External

  subgraph UI_Modules[UI Modules]
    CaptureButton[Capture Button]
    ChatPanel[Chat Panel]
    SearchPanel[Search Panel]
    TimelineView[Timeline View]
    SettingsPage[Settings Page]
  end

  subgraph App_Modules[Application Services]
    CaptureService[CaptureService]
    ChatService[ChatService]
    SyncService[SyncService]
    SearchService[SearchService]
    TimelineService[TimelineService]
  end

  subgraph Infra_Modules[Infrastructure Adapters]
    ReadabilityAdapter[Readability Adapter]
    MarkdownAdapter[Turndown Adapter]
    LLMAdapters[LLM Adapters]
    WebDAVAdapter[WebDAV Adapter]
    DexieRepository[Dexie Repository]
    SearchIndexAdapter[MiniSearch Adapter]
  end

  UI_Modules --> App_Modules
  App_Modules --> Infra_Modules
```

---

# 11. 推荐目录结构

```text
src/
  manifest.json

  background/
    index.ts
    message-router.ts
    commands.ts
    side-panel.ts

  content/
    index.ts
    floating-button.ts
    capture-page.ts
    metadata-extractor.ts

  sidepanel/
    App.tsx
    pages/
      ChatPage.tsx
      SearchPage.tsx
      TimelinePage.tsx
    components/
      MarkdownRenderer.tsx
      ChatInput.tsx
      StreamMessage.tsx

  options/
    App.tsx
    ModelSettings.tsx
    WebDAVSettings.tsx
    PromptSettings.tsx

  workers/
    search.worker.ts

  core/
    documents/
      document.types.ts
      document.service.ts
      document.repository.ts
    chat/
      chat.types.ts
      chat.service.ts
      prompt-builder.ts
    models/
      model.types.ts
      model-router.ts
      adapters/
        openai.adapter.ts
        anthropic.adapter.ts
        gemini.adapter.ts
    sync/
      sync.types.ts
      backup-packager.ts
      webdav-client.ts
      sync.service.ts
    search/
      search.types.ts
      search.client.ts
    timeline/
      timeline.service.ts

  db/
    dexie.ts
    schema.ts
    migrations.ts

  shared/
    messaging/
      messages.ts
      runtime-client.ts
    crypto/
      secret-store.ts
    utils/
      time.ts
      id.ts
      json.ts
```

---

# 12. 核心端到端流程

## 捕获并 AI 消化文章

```mermaid
flowchart LR
  A[用户点击捕获] --> B[Content Script 解析页面]
  B --> C[Readability 提取正文]
  C --> D[Turndown 转 Markdown]
  D --> E[提取元数据]
  E --> F[写入 IndexedDB]
  F --> G[通知 MiniSearch Worker 建索引]
  F --> H[打开 Side Panel]
  H --> I[构建 Prompt]
  I --> J[调用 LLM Stream]
  J --> K[侧边栏 Markdown 流式渲染]
  K --> L[保存 Chat History]
```

## WebDAV 冷同步

```mermaid
flowchart LR
  A[用户点击同步] --> B{上传还是拉取}
  B -->|上传| C[读取 IndexedDB 全量数据]
  C --> D[生成 ReadChat_data.json]
  D --> E[压缩]
  E --> F[PUT 到 WebDAV]
  F --> G[写 metadata.json]

  B -->|拉取| H[GET metadata.json]
  H --> I{远端更新?}
  I -->|是| J[下载数据包]
  J --> K[保存本地快照]
  K --> L[覆盖 IndexedDB]
  I -->|否| M[提示本地已最新]
```

---

# 13. 关键设计原则

- **Local-First**：documents、chatHistories、settings 都以 IndexedDB 为主存储。
- **Extension-First**：捕获、对话、搜索都在扩展内闭环完成。
- **Adapter-Based LLM**：不同模型供应商只实现 adapter，UI 和 ChatService 不感知供应商差异。
- **Cold Sync Only**：WebDAV 使用整包覆盖，避免复杂增量合并。
- **Worker-Based Search**：MiniSearch 索引构建放入 Worker，避免阻塞侧边栏 UI。
- **Schema-Versioned Backup**：备份文件需要带 `schemaVersion`，方便未来迁移。

---
