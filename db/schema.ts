/** 捕获的网页文档 */
export interface CapturedDocument {
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
  image?: string;
  wordCount?: number;
  language?: string;
  schemaOrgData?: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

/** 聊天历史记录 */
export interface ChatHistory {
  id: string;
  documentId: string;
  modelId: string;
  model: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

/** 单条聊天消息 */
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

/** 设置条目 */
export interface SettingsEntry {
  key: string;
  value: unknown;
  updatedAt: number;
}

/** 模型提供者配置 */
export interface ModelProviderConfig {
  id: string;
  name: string;
  provider: 'openai-compatible';
  enabled: boolean;
  apiKey: string;
  baseUrl: string;
  model: string;
  systemPrompt?: string;
  createdAt: number;
  updatedAt: number;
}

/** 搜索结果 */
export interface SearchResult {
  id: string;
  title: string;
  url: string;
  score: number;
  matchPositions?: Record<string, Array<[number, number]>>;
  snippet?: string;
  createdAt: number;
}

/** 流式响应 delta */
export interface StreamDelta {
  type: 'text' | 'reasoning' | 'tool' | 'done' | 'error';
  content?: string;
  error?: string;
}

/** WebDAV 配置 */
export interface WebDAVConfig {
  serverUrl: string;
  username: string;
  password: string;
  remotePath: string;
}

/** 时间轴聚合桶 */
export interface TimelineBucket {
  date: string;
  count: number;
  documentIds: string[];
}
