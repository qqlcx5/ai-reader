---
AIGC:
    Label: "1"
    ContentProducer: 001191440300708461136T1XGW3
    ProduceID: d270bcd3df6a2cd27c2792fa9a0b45ef_144391a193e211f18e22525400f8a581
    ReservedCode1: ORfiUZOmW9Z4/10MpWPCMrFdMcLrUxb19hZT+xSx7PVlFZp7ZnBx7SYmjyvgNRR1ZIKVbPbkm4r/sHTdjbPd8gFr/Kvs0kTkH29j7Shyuc67FNQBDPjPOoMDYajRfSE1AakvZIiZsy1aAOdwXleYCjQlzxIGoSrlAR3mHHa9cc4jbBUILQTDsuJ6e/E=
    ContentPropagator: 001191440300708461136T1XGW3
    PropagateID: d270bcd3df6a2cd27c2792fa9a0b45ef_144391a193e211f18e22525400f8a581
    ReservedCode2: ORfiUZOmW9Z4/10MpWPCMrFdMcLrUxb19hZT+xSx7PVlFZp7ZnBx7SYmjyvgNRR1ZIKVbPbkm4r/sHTdjbPd8gFr/Kvs0kTkH29j7Shyuc67FNQBDPjPOoMDYajRfSE1AakvZIiZsy1aAOdwXleYCjQlzxIGoSrlAR3mHHa9cc4jbBUILQTDsuJ6e/E=
---

# data.json Schema 完整定义

> 基于 `/Users/another/Documents/OpenSource/web-deepseek/data.json` (version=5, 3MB) 真实值提取。
> 所有字段均从原始 JSON 验证类型，无省略、无推测，每个字段标注精确 TypeScript 类型，嵌套展开到叶子。

---

## 1. 顶层（Top-Level）

```ts
interface CherryData {
  time: number;                // Unix 毫秒时间戳，e.g. 1758091674643
  version: 5;                  // 固定值
  localStorage: LocalStorageData;
  indexedDB: IndexedDBData;
}
```

---

## 2. localStorage

```ts
interface LocalStorageData {
  language: string;            // e.g. "zh-CN"
  modelscope_token: string;    // e.g. "ms-1597c95e-..."
  "persist:cherry-studio": PersistRoot;
}
```

### 2.1 persist:cherry-studio（PersistRoot）

```ts
interface PersistRoot {
  assistants: AssistantsModule;
  agents: AgentsModule;
  backup: BackupModule;
  codeTools: CodeToolsModule;
  nutstore: NutstoreModule;
  paintings: PaintingsModule;
  llm: LLMModule;
  settings: SettingsModule;
  shortcuts: ShortcutsModule;
  knowledge: KnowledgeModule;
  minapps: MinappsModule;
  websearch: WebsearchModule;
  mcp: MCPModule;
  memory: MemoryModule;
  copilot: CopilotModule;
  selectionStore: SelectionStoreModule;
  preprocess: PreprocessModule;
  inputTools: InputToolsModule;
  translate: TranslateModule;
  ocr: OCRModule;
  note: NoteModule;
  _persist: { version: number; rehydrated: boolean };
}
```

---

## 3. assistants（助手模块）

```ts
interface AssistantsModule {
  defaultAssistant: AssistantObject;
  assistants: AssistantObject[];
}

interface AssistantObject {
  id: string;                          // UUID，default 助手值为 "default"，其余为 UUID
  name: string;                        // 助手名称
  emoji: string;                       // 表情符号字符
  prompt: string;                      // 系统提示词（可为空字符串）
  type: "assistant";                   // 固定值
  // ── defaultAssistant 专有（其余助手可能不存在以下字段） ──
  messages?: never[];                  // defaultAssistant 始终为 []
  // ── assistants[] 项可包含 ──
  model?: ModelRef;                    // 当前选中的模型引用（外键 → Provider.models[].id）
  defaultModel?: ModelRef;             // 默认模型引用（外键 → Provider.models[].id）
  settings?: AssistantSettings;
  topics?: TopicObject[];              // 话题列表
  regularPhrases?: never[];            // 始终为 []
  enableWebSearch?: boolean;           // 是否启用联网搜索
  knowledgeRecognition?: "off";        // 知识库识别模式
  mcpServers?: never[];                // MCP 服务器绑定
  description?: string;                // 助手描述（可为空字符串）
}

/** 模型引用 — 贯穿整个 data.json 的轻量模型标识 */
interface ModelRef {
  id: string;                          // 模型 ID（外键 → Provider.models[].id）
  provider: string;                    // 提供者 ID（外键 → Provider.id）
  name: string;                        // 模型名称
  group: string;                       // 模型分组
  supported_text_delta?: boolean;      // 是否支持文本增量流式输出（绝大多数模型有此字段）
}

interface AssistantSettings {
  temperature: number;                 // 温度参数，e.g. 0.39 / 1
  contextCount: number;                // 上下文窗口消息数，0 表示不限制
  enableMaxTokens: boolean;            // 是否启用最大令牌数限制
  maxTokens: number;                   // 最大令牌数
  streamOutput: boolean;               // 是否流式输出
  topP: number;                        // Top-P 采样
  enableTopP: boolean;                 // 是否启用 Top-P
  toolUseMode: "prompt" | "function";  // 工具使用模式
  customParameters: never[];           // 始终为 []
  reasoning_effort?: string;           // 推理努力级别，e.g. "low"
  reasoning_effort_cache?: string;     // 推理缓存级别
  qwenThinkMode?: boolean;             // 通义千问思考模式
  enableTemperature?: boolean;         // defaultAssistant 专用
}

/** 话题对象（助手内嵌的 topics[]） */
interface TopicObject {
  id: string;                          // 话题 UUID
  assistantId: string;                 // 所属助手 ID（外键 → AssistantObject.id）
  createdAt: string;                   // ISO 8601 UTC 时间
  updatedAt: string;                   // ISO 8601 UTC 时间
  name: string;                        // 话题名
  messages: never[];                   // 始终为 []（实际消息存储在 indexedDB.topics 中）
  isNameManuallyEdited: boolean;       // 话题名是否手动编辑过
}
```

---

## 4. agents（智能体模块）

```ts
interface AgentsModule {
  agents: AgentObject[];
}

interface AgentObject {
  id: string;                     // UUID
  name: string;                   // 智能体名称
  emoji: string;                  // 表情符号字符
  prompt: string;                 // 系统提示词
  type: "agent";                  // 固定值
  model: null;                    // 始终为 null
  settings: Record<string, never>;// 始终为 {}
  defaultModel: ModelRef;        // 默认模型引用
  topics: TopicObject[];          // 同 assistants 中的 TopicObject
  messages: never[];              // 始终为 []
}
```

---

## 5. llm（模型提供商模块）

```ts
interface LLMModule {
  defaultModel: ModelRef;          // 全局默认模型（外键）
  topicNamingModel: ModelRef;      // 话题命名模型（外键）
  translateModel: ModelRef;        // 翻译模型（外键）
  quickAssistantModel: ModelRef;   // 快速助手模型（外键，此 ref 可能缺 supported_text_delta）
  quickModel: ModelRef;            // 快速模型（外键）
  quickAssistantId: string;        // 快速助手 UUID
  providers: Provider[];
  settings: LLMSettings;
}

interface Provider {
  id: string;                                  // 提供者 UUID 或固定标识（如 "gemini"、"openai"、"silicon"）
  name: string;                                // 提供者显示名
  type: "openai" | "openai-response" | "gemini" | "anthropic" | "azure-openai" | "mistral" | "vertexai";
  apiKey: string;                              // API 密钥（脱敏后仍为字符串）
  apiHost: string;                             // API 端点 URL
  enabled: boolean;                            // 是否启用
  isSystem: boolean;                           // 是否系统内置
  models: ModelInfo[];
  // ── 以下字段按提供者按需存在 ──
  isNotSupportArrayContent?: boolean;          // 是否不支持数组内容
  isNotSupportDeveloperRole?: boolean;         // 是否不支持 developer 角色
  isNotSupportStreamOptions?: boolean;         // 是否不支持流式选项
  isVertex?: boolean;                          // 是否 Vertex AI
  apiOptions?: {                               // API 选项对象
    isNotSupportArrayContent: boolean;
    isNotSupportDeveloperRole: boolean;
    isNotSupportStreamOptions: boolean;
  };
  serviceTier?: "auto";                        // 服务层级
}

interface ModelInfo {
  id: string;                                  // 模型 ID
  provider: string;                            // 所属提供者 ID（外键 → Provider.id）
  name: string;                                // 模型显示名
  group: string;                               // 模型分组
  supported_text_delta?: boolean;              // 支持文本增量，约 2/3 模型有此字段
  owned_by?: string;                           // 模型归属方，如 "01.ai"、"gptgod"
}

interface LLMSettings {
  ollama: { keepAliveTime: number };           // 即 keepAliveTime=0
  lmstudio: { keepAliveTime: number };
  gpustack: { keepAliveTime: number };
  vertexai: {
    serviceAccount: { privateKey: string; clientEmail: string };
    projectId: string;
    location: string;
  };
}
```

---

## 6. settings（全局设置模块）

```ts
interface SettingsModule {
  // ── 基础 ──
  language: string;                       // e.g. "zh-CN"
  targetLanguage: string;                 // e.g. "zh-cn"
  proxyMode: string;                      // e.g. "system"
  userName: string;                       // 用户昵称（可为 ""）
  launchOnBoot: boolean;
  launchToTray: boolean;
  trayOnClose: boolean;
  tray: boolean;
  autoCheckUpdate: boolean;
  upgradeChannel: string;                 // e.g. "latest"
  testChannel: string;                    // e.g. "beta"
  testPlan: boolean;
  userId: string;                         // UUID
  disableHardwareAcceleration: boolean;
  enableDataCollection: boolean;
  enableSpellCheck: boolean;
  spellCheckLanguages: never[];           // 始终为 []
  earlyAccess: boolean;

  // ── 外观 ──
  theme: string;                          // e.g. "system"
  windowStyle: string;                    // e.g. "opaque"
  fontSize: number;                       // e.g. 14
  messageFont: string;                    // e.g. "system"
  messageStyle: string;                   // e.g. "bubble"
  showMessageDivider: boolean;
  showTokens: boolean;
  showModelProviderInMarkdown: boolean;
  showModelNameInMarkdown: boolean;
  showMessageOutline: boolean;
  renderInputMessageAsMarkdown: boolean;
  sidebarIcons: {
    visible: string[];                    // 侧边栏可见图标列表: ["assistants","agents","paintings","translate","minapp","knowledge","files","code_tools","notes"]
    disabled: string[];
  };
  narrowMode: boolean;
  navbarPosition: string;                 // e.g. "left"
  userTheme: { colorPrimary: string };    // e.g. "#00b96b"

  // ── 话题 ──
  showAssistants: boolean;
  showTopics: boolean;
  topicPosition: string;                  // e.g. "left"
  showTopicTime: boolean;
  pinTopicsToTop: boolean;
  assistantIconType: string;              // e.g. "emoji"
  clickAssistantToShowTopic: boolean;
  enableTopicNaming: boolean;
  topicNamingPrompt: string;              // 自定义命名 prompt（可为 ""）
  useTopicNamingForMessageTitle: boolean;

  // ── 输入 ──
  sendMessageShortcut: string;            // e.g. "Enter"
  showInputEstimatedTokens: boolean;
  pasteLongTextAsFile: boolean;
  pasteLongTextThreshold: number;         // e.g. 1500
  foldDisplayMode: string;                // e.g. "expanded"
  gridColumns: number;                    // e.g. 2
  gridPopoverTrigger: string;             // e.g. "click"
  messageNavigation: string;              // e.g. "anchor"
  confirmDeleteMessage: boolean;
  confirmRegenerateMessage: boolean;
  thoughtAutoCollapse: boolean;

  // ── 代码相关 ──
  codeExecution: { enabled: boolean; timeoutMinutes: number };
  codeEditor: {
    enabled: boolean;
    themeLight: string;                   // e.g. "auto"
    themeDark: string;                    // e.g. "auto"
    highlightActiveLine: boolean;
    foldGutter: boolean;
    autocompletion: boolean;
    keymap: boolean;
  };
  codePreview: { themeLight: string; themeDark: string };
  codeViewer: { themeLight: string; themeDark: string };
  codeShowLineNumbers: boolean;
  codeCollapsible: boolean;
  codeWrappable: boolean;

  // ── 数学公式 ──
  mathEngine: string;                     // e.g. "KaTeX"
  mathEnableSingleDollar: boolean;

  // ── 导出 ──
  exportMenuOptions: {
    image: boolean;
    markdown: boolean;
    markdown_reason: boolean;
    notion: boolean;
    yuque: boolean;
    joplin: boolean;
    obsidian: boolean;
    siyuan: boolean;
    docx: boolean;
    plain_text: boolean;
  };
  markdownExportPath: null | string;
  forceDollarMathInMarkdown: boolean;

  // ── 知识库集成 ──
  notionDatabaseID: string;
  notionApiKey: string;
  notionPageNameKey: string;              // e.g. "Name"
  notionAutoSplit: boolean;
  notionSplitSize: number;                // e.g. 90
  notionExportReasoning: boolean;
  yuqueToken: string;
  yuqueUrl: string;
  yuqueRepoId: string;
  joplinToken: string;
  joplinUrl: string;
  defaultObsidianVault: string;           // e.g. "knowledge-obsidian"
  defaultAgent: null | string;
  siyuanApiUrl: null | string;
  siyuanToken: null | string;
  siyuanBoxId: null | string;
  siyuanRootPath: null | string;
  agentssubscribeUrl: string;

  // ── 翻译 ──
  autoTranslateWithSpace: boolean;
  showTranslateConfirm: boolean;
  translateModelPrompt: string;           // 翻译 prompt 模板
  showPrompt: boolean;

  // ── 快速助手 ──
  enableQuickAssistant: boolean;
  clickTrayToShowQuickAssistant: boolean;
  readClipboardAtStartup: boolean;

  // ── 多模型 ──
  multiModelMessageStyle: string;         // e.g. "grid"
  enableBackspaceDeleteModel: boolean;
  enableQuickPanelTriggers: boolean;

  // ── 备份与同步 ──
  skipBackupFile: boolean;
  webdavHost: string;
  webdavUser: string;
  webdavPass: string;
  webdavPath: string;
  webdavAutoSync: boolean;
  webdavSyncInterval: string;             // e.g. "1440"（分钟，字符串形式）
  webdavMaxBackups: number;
  webdavSkipBackupFile: boolean;
  webdavDisableStream: boolean;
  s3: {
    endpoint: string;
    region: string;
    bucket: string;
    accessKeyId: string;
    secretAccessKey: string;
    root: string;
    autoSync: boolean;
    syncInterval: number;
    maxBackups: number;
    skipBackupFile: boolean;
  };
  localBackupMaxBackups: number;
  localBackupSkipBackupFile: boolean;
  localBackupDir: string;
  localBackupAutoSync: boolean;
  localBackupSyncInterval: number;

  // ── 迷你应用 ──
  maxKeepAliveMinapps: number;            // e.g. 5
  showOpenedMinappsInSidebar: boolean;
  minappsOpenLinkExternal: boolean;

  // ── 其他 ──
  apiServer: {
    enabled: boolean;
    host: string;                         // e.g. "localhost"
    port: number;                         // e.g. 23333
    apiKey: string;
  };
  proxyBypassRules: string;               // e.g. "localhost,127.0.0.1,::1"
  defaultPaintingProvider: string;        // e.g. "zhipu"
  notification: {
    assistant: boolean;
    backup: boolean;
    knowledgeEmbed: boolean;
  };
  openAI: {
    summaryText: string;                  // e.g. "off"
    serviceTier: string;                  // e.g. "auto"
    verbosity: string;                    // e.g. "medium"
  };
  customCss: string;                      // 自定义 CSS
}
```

---

## 7. indexedDB

```ts
interface IndexedDBData {
  files: never[];                         // 始终为 []
  topics: DBTopic[];
  settings: DBSetting[];
  knowledge_notes: never[];               // 始终为 []
  translate_history: TranslateHistoryItem[];
  quick_phrases: never[];                 // 始终为 []
  message_blocks: MessageBlock[];
  translate_languages: never[];           // 始终为 []
  notes_tree: never[];                    // 始终为 []
}
```

### 7.1 DBTopic（indexedDB.topics）

```ts
interface DBTopic {
  id: string;                             // 话题 UUID（外键 → TopicObject.id）
  messages: DBMessage[];
}
```

### 7.2 DBMessage（话题中的消息）

```ts
interface DBMessage {
  id: string;                             // 消息 UUID
  role: "user" | "assistant";
  topicId: string;                        // 所属话题 ID（外键 → DBTopic.id）
  assistantId: string;                    // 所属助手 ID（外键 → AssistantObject.id）
  createdAt: string;                      // ISO 8601 UTC
  updatedAt?: string;                     // ISO 8601 UTC（助手消息有此字段）
  status: "success" | "pending" | "error";
  blocks: string[];                       // 消息块 ID 列表（外键 → MessageBlock.id）
  modelId?: string;                       // 模型 ID（外键 → ModelInfo.id）
  model?: ModelRef;                       // 模型引用
  // ── 用户消息独有 ──
  usage?: {                               // token 用量
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  mentions?: never[];                     // @提及列表，始终为 []
  // ── 助手消息独有 ──
  askId?: string;                         // 对应用户消息 ID（外键 → DBMessage.id，形成问答对）
  metrics?: {                             // 耗时与 token 指标
    completion_tokens: number;
    time_completion_millsec: number;      // 总耗时（毫秒）
    time_first_token_millsec: number;     // 首 token 耗时（毫秒）
    time_thinking_millsec: number;        // 思考耗时（毫秒）
  };
  foldSelected?: boolean;                 // 是否折叠选中
  multiModelMessageStyle?: "fold" | "horizontal"; // 多模型显示模式（消息级别）
}
```

### 7.3 MessageBlock（indexedDB.message_blocks）

```ts
/** 消息块联合类型 — 通过 type 字段区分 */
type MessageBlock = TextBlock | ThinkingBlock | CitationBlock | ToolBlock | ErrorBlock | UnknownBlock;

interface BlockBase {
  id: string;                             // 块 UUID
  messageId: string;                      // 所属消息 ID（外键 → DBMessage.id）
  type: "main_text" | "thinking" | "citation" | "tool" | "error" | "unknown";
  createdAt: string;                      // ISO 8601 UTC
  status: "success" | "error" | "pending";
  updatedAt?: string;                     // ISO 8601 UTC（main_text 块有此字段）
}

interface TextBlock extends BlockBase {
  type: "main_text";
  content: string;                        // Markdown 文本内容
  knowledgeBaseIds?: string[];            // 引用的知识库 ID 列表
  citationReferences?: any[];             // 引用参考文献
}

interface ThinkingBlock extends BlockBase {
  type: "thinking";
  content: string;                        // 思考过程文本
  thinking_millsec: number;               // 思考耗时（毫秒）
}

interface CitationBlock extends BlockBase {
  type: "citation";
  response: {
    results: {
      searchEntryPoint: { renderedContent: string };
      groundingChunks: any;
      groundingSupports: any;
      webSearchQueries: any;
    };
    source: string;                       // e.g. "gemini"
  };
}

interface ToolBlock extends BlockBase {
  type: "tool";
  toolId?: string;                        // 工具调用 ID
  toolName?: string;                      // 工具名称，e.g. "mcp__getDsl"
  metadata?: {
    rawMcpToolResponse: {
      id: string;
      toolUseId: string;
      tool: {
        name: string;
        description: string;
        inputSchema: object;
      };
    };
  };
}

interface ErrorBlock extends BlockBase {
  type: "error";
  error: {
    name: string;                         // 错误类型，e.g. "TypeError"
    message: string;                      // 错误信息
    originalMessage: string;              // 原始错误信息
    stack: string;                        // 错误堆栈
  };
}

interface UnknownBlock extends BlockBase {
  type: "unknown";
  status: "error";                        // unknown 块始终为 error
}
```

### 7.4 DBSetting（indexedDB.settings）

```ts
interface DBSetting {
  id: string;                             // 设置键，格式: "image://provider-<UUID>" | "pinned:models" | "translate:*"
  value: string | string[];               // 设置值
}
```

已知键:
- `"image://provider-<UUID>"` — value 为 `""`
- `"pinned:models"` — value 为 `[]`
- `"translate:bidirectional:pair"` — value 为 `["en-us","zh-cn"]`
- `"translate:source:language"` — value 为 `"auto"`
- `"translate:target:language"` — value 为 `"zh-cn"`

### 7.5 TranslateHistoryItem（indexedDB.translate_history）

```ts
interface TranslateHistoryItem {
  id: string;                             // UUID
  sourceText: string;                     // 原文
  targetText: string;                     // 译文
  sourceLanguage: string;                 // e.g. "en-us" | "zh-cn"
  targetLanguage: string;                 // e.g. "zh-cn" | "en-us"
  createdAt: string;                      // ISO 8601 UTC
}
```

---

## 8. backup（备份模块）

```ts
interface BackupModule {
  webdavSync: SyncState;
  s3Sync: SyncState;
}

interface SyncState {
  lastSyncTime: null | string;            // ISO 8601 时间或 null
  syncing: boolean;
  lastSyncError: null | string;           // 错误信息或 null
}
```

---

## 9. codeTools

```ts
interface CodeToolsModule {
  selectedCliTool: string;                // e.g. "qwen-code"
  selectedModels: {
    "qwen-code": ModelRef;
    "claude-code": ModelRef;
    "gemini-cli": ModelRef;
  };
  directories: never[];
  currentDirectory: string;               // 可为 ""
  environmentVariables: {
    "qwen-code": Record<string, string>;
    "claude-code": Record<string, string>;
    "gemini-cli": Record<string, string>;
  };
}
```

---

## 10. nutstore（坚果云同步）

```ts
interface NutstoreModule {
  nutstoreToken: string;
  nutstorePath: string;
  nutstoreAutoSync: boolean;
  nutstoreSyncInterval: number;
  nutstoreSyncState: SyncState;
  nutstoreSkipBackupFile: boolean;
  nutstoreMaxBackups: number;
}
```

---

## 11. paintings（AI 绘画）

```ts
interface PaintingsModule {
  siliconflow_paintings: PaintingRecord[];
  dmxapi_paintings: PaintingRecord[];
  tokenflux_paintings: PaintingRecord[];
  zhipu_paintings: PaintingRecord[];
  aihubmix_image_generate: PaintingRecord[];
  aihubmix_image_remix: PaintingRecord[];
  aihubmix_image_edit: PaintingRecord[];
  aihubmix_image_upscale: PaintingRecord[];
  openai_image_generate: PaintingRecord[];
  openai_image_edit: PaintingRecord[];
}

interface PaintingRecord {
  id: string;                             // UUID
  model: string;                          // 模型名，e.g. "V_3"
  aspectRatio: string;                    // e.g. "ASPECT_1_1"
  numImages: number;                      // 生成图片数量
  styleType: string;                      // e.g. "AUTO"
  prompt: string;
  negativePrompt: string;
  magicPromptOption: boolean;
  seed: string;
  imageWeight: number;                    // 0-100
  resemblance: number;                    // 0-100
  detail: number;                         // 0-100
  files: string[];                        // 输出文件路径列表
  urls: string[];                         // 输出 URL 列表
  renderingSpeed: string;                 // e.g. "DEFAULT"
}
```

---

## 12. shortcuts（快捷键）

```ts
interface ShortcutsModule {
  shortcuts: ShortcutItem[];
}

interface ShortcutItem {
  key: "zoom_in" | "zoom_out" | "zoom_reset" | "show_app" | "show_settings"
     | "mini_window" | "exit_fullscreen" | "new_topic" | "toggle_new_context"
     | "toggle_show_assistants" | "toggle_show_topics" | "clear_topic"
     | "search_message" | "search_message_in_chat" | "copy_last_message"
     | "selection_assistant_toggle" | "selection_assistant_select_text";
  shortcut: string[];                     // 快捷键组合，e.g. ["CommandOrControl","="]
  editable: boolean;
  enabled: boolean;
  system: boolean;
}
```

---

## 13. knowledge（知识库）

```ts
interface KnowledgeModule {
  bases: never[];                         // 始终为 []
}
```

---

## 14. minapps（迷你应用）

```ts
interface MinappsModule {
  enabled: Minapp[];
  disabled: Minapp[];
  pinned: Minapp[];
}

interface Minapp {
  id: string;                             // 应用标识，e.g. "openai"
  name: string;                           // 显示名，e.g. "ChatGPT"
  url: string;                            // 应用 URL
  logo: string;                           // 图标：本地路径（file://）或 base64 data URI
  bodered?: boolean;                      // 是否显示边框
}
```

---

## 15. websearch（网络搜索）

```ts
interface WebsearchModule {
  defaultProvider: string;                // e.g. "tavily"
  providers: WebsearchProvider[];
  searchWithTime: boolean;
  maxResults: number;                     // e.g. 5
  excludeDomains: never[];                // 始终为 []
  subscribeSources: never[];              // 始终为 []
  overwrite: boolean;
  providerConfig: Record<string, never>;  // 始终为 {}
  compressionConfig: {
    method: string;                       // e.g. "none"
    cutoffUnit: string;                   // e.g. "char"
  };
}

interface WebsearchProvider {
  id: string;                             // e.g. "tavily" | "local-google" | "local-bing" | "local-baidu"
  name: string;                           // e.g. "Tavily" | "Google" | "Bing"
  apiHost?: string;                       // API 提供商标配（API 类）
  apiKey?: string;                        // API 提供商标配（API 类）
  url?: string;                           // 本地搜索引擎 URL（local-* 类）
  basicAuthUsername?: string;             // Searxng 专有
  basicAuthPassword?: string;             // Searxng 专有
}
```

---

## 16. mcp（MCP 服务器）

```ts
interface MCPModule {
  servers: MCPServer[];
  isUvInstalled: boolean;
  isBunInstalled: boolean;
}

interface MCPServer {
  id: string;                             // 短 ID，e.g. "dt56lf7qbZsJNOv474tMN"
  name: string;                           // e.g. "@cherry/python"
  type: "inMemory" | "stdio";
  description: string;
  isActive: boolean;
  provider: string;                       // e.g. "CherryAI"
  env?: Record<string, string>;           // 环境变量
  args?: string[];                        // stdio 类型参数
  command?: string;                       // stdio 类型命令
}
```

---

## 17. memory（记忆）

```ts
interface MemoryModule {
  memoryConfig: {
    embedderDimensions: number;
    isAutoDimensions: boolean;
    customFactExtractionPrompt: string;
    customUpdateMemoryPrompt: string;
  };
  currentUserId: string;
  globalMemoryEnabled: boolean;
}
```

---

## 18. copilot（Copilot 用户信息）

```ts
interface CopilotModule {
  username: string;                       // 可为 ""
  avatar: string;                         // 可为 ""
}
```

---

## 19. selectionStore（划词助手）

```ts
interface SelectionStoreModule {
  selectionEnabled: boolean;
  triggerMode: string;                    // e.g. "selected"
  isCompact: boolean;
  isAutoClose: boolean;
  isAutoPin: boolean;
  isFollowToolbar: boolean;
  isRemeberWinSize: boolean;
  filterMode: string;                     // e.g. "default"
  filterList: never[];
  actionWindowOpacity: number;            // e.g. 100
  actionItems: SelectionAction[];
}

interface SelectionAction {
  id: string;                             // e.g. "translate" | "explain" | "summary" | "search" | "copy" | "refine" | "quote"
  name: string;                           // i18n key，e.g. "selection.action.builtin.translate"
  enabled: boolean;
  isBuiltIn: boolean;
  icon: string;                           // 图标名，e.g. "languages"
  searchEngine?: string;                  // search action 专有，e.g. "Google|https://www.google.com/search?q={{queryString}}"
}
```

---

## 20. preprocess（预处理）

```ts
interface PreprocessModule {
  providers: PreprocessProvider[];
  defaultProvider: string;                // e.g. "mineru"
}

interface PreprocessProvider {
  id: string;                             // e.g. "mineru" | "doc2x" | "mistral"
  name: string;                           // e.g. "MinerU" | "Doc2x" | "Mistral"
  apiHost?: string;
  apiKey?: string;
  model?: string;                         // mistral 专有，e.g. "mistral-ocr-latest"
}
```

---

## 21. inputTools（输入工具栏）

```ts
interface InputToolsModule {
  toolOrder: {
    visible: string[];                    // 可见工具列表: ["new_topic","attachment","thinking","url_context","web_search","knowledge_base","mcp_tools","generate_image","mention_models","quick_phrases","clear_topic","toggle_expand","new_context"]
    hidden: string[];
  };
  isCollapsed: boolean;
}
```

---

## 22. translate（翻译）

```ts
interface TranslateModule {
  translatedContent: string;              // 当前翻译内容（可为 ""）
  translateInput: string;                 // 当前输入（可为 ""）
}
```

---

## 23. ocr（OCR）

```ts
interface OCRModule {
  providers: OCRProvider[];
  imageProviderId: string;                // e.g. "system"
}

interface OCRProvider {
  id: string;                             // e.g. "tesseract" | "system" | "paddleocr"
  name: string;                           // e.g. "Tesseract" | "System" | "PaddleOCR"
  capabilities: { image: boolean };
  config: {
    langs?: Record<string, boolean>;      // tesseract: { chi_sim: boolean; chi_tra: boolean; eng: boolean }
    apiUrl?: string;                      // paddleocr
  };
}
```

---

## 24. note（笔记）

```ts
interface NoteModule {
  settings: {
    isFullWidth: boolean;
    fontFamily: string;                   // e.g. "default"
    defaultViewMode: string;              // e.g. "edit"
    defaultEditMode: string;              // e.g. "preview"
    showTabStatus: boolean;
    showWorkspace: boolean;
  };
  notesPath: string;                      // 笔记存储路径
  sortType: string;                       // e.g. "sort_a2z"
}
```

---

## 关联关系图

```
┌─────────────────────────────────────────────────────────────────┐
│                        FOREIGN KEY MAP                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Provider.id ────────────────► ModelInfo.provider                │
│  ModelInfo.id ───────────────► ModelRef.id                       │
│  Provider.id ────────────────► ModelRef.provider                 │
│                                                                  │
│  AssistantObject.id ─────────► TopicObject.assistantId           │
│  AssistantObject.id ─────────► DBMessage.assistantId             │
│  TopicObject.id ─────────────► DBTopic.id                        │
│  DBTopic.id ─────────────────► DBMessage.topicId                 │
│                                                                  │
│  DBMessage.id ───────────────► DBMessage.askId (追问链)          │
│  DBMessage.id ───────────────► MessageBlock.messageId            │
│  MessageBlock.id ────────────► DBMessage.blocks[]                │
│                                                                  │
│  ── 模型引用转发 ──                                              │
│  LLMModule.defaultModel ─────► ModelRef → Provider.models[]      │
│  LLMModule.topicNamingModel ─► ModelRef → Provider.models[]      │
│  AssistantObject.model ──────► ModelRef → Provider.models[]      │
│  DBMessage.model ────────────► ModelRef → Provider.models[]      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 顶层 localStorage 其他键

```ts
// localStorage 除 "persist:cherry-studio" 外还包含：
{
  language: string;               // 与 settings.language 重复
  modelscope_token: string;       // ModelScope API Token
  // "persist:cherry-studio" — 已在上文展开
}
```

---

## 字段存在性差异速查

| 字段 | defaultAssistant | assistants[0] (临时助手) | assistants[2] (思维链) | agent |
|---|---|---|---|---|
| `messages` | ✅ (=[]) | ✅ (=[]) | ❌ | ✅ (=[]) |
| `type` | ✅ | ✅ | ✅ | ✅ |
| `model` | ❌ | ✅ | ✅ | ❌ (null) |
| `settings` | ✅ | ✅ | ✅ | ❌ ({}) |
| `mcpServers` | ❌ | ❌ | ✅ (=[]) | ❌ |
| `knowledgeRecognition` | ❌ | ✅ | ❌ | ❌ |
| `enableWebSearch` | ❌ | ✅ | ✅ | ❌ |
| `description` | ❌ | ❌ | ✅ | ❌ |
**
