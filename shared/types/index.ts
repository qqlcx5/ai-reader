/**
 * 共享类型定义
 * 跨 context（background / content / sidepanel / options）共用
 * 参考 doc/tasks/persistence.md 章节 1，doc/tasks/model-management.md 章节 1
 */

/**
 * 捕获的文档
 * 参考 doc/tasks/perception.md 章节 3, 4
 */
export interface CapturedDocument {
  id: string;
  url: string;
  title: string;
  markdownContent: string;
  rawHtml?: string; // 可选，压缩存储
  author?: string;
  publishedAt?: string;
  description?: string;
  keywords?: string[];
  siteName?: string;
  image?: string;
  favicon?: string;
  language?: string;
  wordCount?: number;
  schemaOrgData?: unknown;
  createdAt: number;
  updatedAt: number;
}

/**
 * 提取的元数据
 * 参考 doc/tasks/perception.md 章节 3
 */
export interface DocumentMetadata {
  title: string;
  url: string;
  author?: string;
  publishedAt?: string;
  description?: string;
  keywords?: string[];
  siteName?: string;
  image?: string;
  favicon?: string;
  language?: string;
  wordCount?: number;
  schemaOrgData?: unknown;
}

/**
 * 提取响应
 */
export interface ContentResponse {
  markdownContent: string;
  metadata: DocumentMetadata;
}

/**
 * 模型配置
 * 参考 doc/tasks/model-management.md 章节 1
 */
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

/**
 * 设置项
 */
export interface AppSettings {
  defaultModelId?: string;
  globalSystemPrompt?: string;
  captureShortcut?: string;
  captureShortcutEnabled?: boolean;
  theme?: 'light' | 'dark' | 'auto';
  lastSyncAt?: number;
  syncState?: 'idle' | 'syncing' | 'success' | 'error';
  // WebDAV
  webdavUrl?: string;
  webdavUsername?: string;
  webdavPassword?: string;
  webdavRemoteDir?: string;
  // 自动同步（保存文档后触发）
  autoSync?: boolean;
}

/**
 * 聊天消息
 * 参考 doc/tasks/chat-with-doc.md 章节 6
 */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: number;
  // 错误状态
  error?: boolean;
  // 用于流式增量
  pending?: boolean;
}

/**
 * 聊天历史
 */
export interface ChatHistory {
  id: string;
  documentId: string;
  modelId: string;
  model: string;
  title?: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

/**
 * 备份包（导入/导出）
 * 参考 doc/tasks/persistence.md 章节 3
 */
export interface BackupPackage {
  schemaVersion: number;
  documents: CapturedDocument[];
  chatHistories: ChatHistory[];
  models: ModelProviderConfig[];
  settings: AppSettings;
  exportedAt: number;
  version: string;
}

/**
 * 跨上下文消息协议
 * 参考 doc/tasks/foundation.md 章节 5
 */
export type MessageMap = {
  CAPTURE_PAGE: { tabId: number };
  CAPTURE_RESULT: { documentId: string };
  START_CHAT: { documentId: string; question: string; modelId?: string };
  CHAT_STREAM_CHUNK: { documentId: string; delta: string; done: boolean };
  STOP_CHAT: { documentId: string };
  SEARCH_QUERY: { query: string; limit?: number };
  SEARCH_RESULTS: { results: SearchResult[] };
  SYNC_UPLOAD: void;
  SYNC_DOWNLOAD: void;
  SYNC_STATUS: { state: 'idle' | 'syncing' | 'success' | 'error'; message?: string };
  PING_MODEL: { modelId: string };
  PING_RESULT: { success: boolean; message?: string };
  GET_DOCUMENT: { documentId: string };
  GET_DOCUMENT_RESULT: { document?: CapturedDocument };
  LIST_DOCUMENTS: { limit?: number; offset?: number };
  LIST_DOCUMENTS_RESULT: { documents: CapturedDocument[]; total: number };
  DELETE_DOCUMENT: { documentId: string };
};

/**
 * 消息包装
 */
export interface MessageEnvelope<T = unknown> {
  type: keyof MessageMap;
  payload: T;
  requestId?: string;
  timestamp: number;
}

/**
 * 搜索结果
 * 参考 doc/tasks/search.md 章节 1
 */
export interface SearchResult {
  id: string;
  title: string;
  url: string;
  createdAt: number;
  score: number;
  snippet?: string;
  matches?: string[];
}

/**
 * 时间轴桶（按天聚合）
 * 参考 doc/tasks/timeline.md 章节 1
 */
export interface TimelineBucket {
  date: string; // YYYY-MM-DD
  count: number;
  documentIds: string[];
}

/**
 * 时间轴聚合结果
 */
export interface TimelineResult {
  buckets: TimelineBucket[];
  total: number;
  streak: number;
}

/**
 * 消息响应包装
 */
export interface MessageResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  requestId?: string;
}

/**
 * Content Script → Background 的标准响应
 */
export type ContentCapturePayload = {
  url: string;
  title: string;
  markdownContent: string;
  metadata: DocumentMetadata;
};
