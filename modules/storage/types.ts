/**
 * M7 Storage & Data Layer — Shared types
 */

export type ConversationMode = 'chat' | 'roundtable' | 'relay';

export type MessageRole = 'user' | 'assistant' | 'system';

export interface ModelResponse {
  providerId: string;
  modelId?: string;
  content: string;
  /** Token / timing metrics (optional, populated by M3) */
  metrics?: {
    inputTokens?: number;
    outputTokens?: number;
    latencyMs?: number;
  };
  createdAt?: number;
}

export interface ConversationRecord {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  mode: ConversationMode;
  activeProviderIds: string[];
  /** 消息数量（不存内容） */
  messageCount: number;
  /** 首条消息摘要，用于列表预览 */
  preview: string;
  /** 根消息 ID */
  rootMessageId?: string;
}

export interface MessageRecord {
  id: string;
  conversationId: string;
  parentId?: string;
  role: MessageRole;
  /** 用户消息内容（通常较短） */
  content?: string;
  /** 多模型完整回复 JSON（可能极大） */
  modelResponses: ModelResponse[];
  createdAt: number;
}

export interface RssItemRecord {
  id: string;
  feedId: string;
  title?: string;
  pubDate: number;
  isRead: boolean;
  hash: string;
  content?: string;
  url?: string;
}

export interface RssFeedRecord {
  id: string;
  url: string;
  enabled: boolean;
  lastFetchedAt: number;
  title?: string;
  refreshIntervalMinutes?: number;
}

export interface ProviderConfig {
  id: string;
  name: string;
  type: 'openai' | 'anthropic' | 'gemini' | 'custom';
  apiKey: string;
  baseUrl?: string;
  defaultModel?: string;
  enabled?: boolean;
  /** Extension point for phase-2 encrypted storage adapter */
  storage?: 'plaintext' | 'encrypted';
}

export interface PromptTemplate {
  id: string;
  name: string;
  content: string;
  mode?: ConversationMode;
}

export interface ExportConfig {
  format: 'markdown' | 'json' | 'zip' | 'obsidian';
  includeApiKeys: boolean;
  autoBackupEnabled: boolean;
  autoBackupIntervalDays?: number;
  webDAVUrl?: string;
  obsidianVault?: string;
}

export interface RssConfig {
  enabled: boolean;
  fetchIntervalMinutes: number;
  maxItemsPerFeed: number;
  aiSummaryEnabled: boolean;
  summaryProviderId?: string;
}

export interface UiSettings {
  theme: 'light' | 'dark' | 'system';
  sidebarWidth: number;
  language?: string;
}

export interface Settings {
  providers: ProviderConfig[];
  prompts: PromptTemplate[];
  exportConfig: ExportConfig;
  rssConfig: RssConfig;
  ui: UiSettings;
}

export type ContextMode = 'summary' | 'full' | 'selected' | 'relay';

export interface CurrentContext {
  title: string;
  url: string;
  excerpt: string;
  fullText: string;
  readabilityHtml: string;
  rawText: string;
  mode: ContextMode;
  /** Unique transfer id when content is chunked across contexts */
  transferId?: string;
  /** URL hash / anchor for re-anchoring reader view */
  anchor?: string;
}

export interface UiState {
  activePanel: 'chat' | 'history' | 'rss' | 'settings';
  sidebarCollapsed: boolean;
  showTokenMetrics: boolean;
  selectedConversationId?: string;
  selectedFeedId?: string;
  /** 搜索框关键词（主线程标题过滤） */
  historySearchKeyword: string;
  /** Worker 深度检索结果 */
  deepSearchResults?: SearchResult[];
}

export interface SearchResult {
  messageId: string;
  conversationId: string;
  snippet: string;
  matchIndex: number;
}

export interface SearchWorkerPayload {
  query: string;
  messages: MessageRecord[];
  requestId: string;
}

export interface SearchWorkerResponse {
  results: SearchResult[];
  requestId: string;
}

export interface ChunkCacheAPI {
  setTransferMeta(id: string, meta: { totalChunks: number; totalSize: number }): Promise<void>;
  setChunk(id: string, index: number, data: string): Promise<void>;
  getAllChunks(id: string): Promise<string[]>;
  clearTransfer(id: string): Promise<void>;
}

export interface PaginationOptions {
  limit?: number;
  offset?: number;
  order?: 'asc' | 'desc';
}

export interface PageResult<T> {
  items: T[];
  total: number;
  hasMore: boolean;
  nextOffset: number;
}

export type PersistedStoreId = 'ui' | 'context' | 'settings' | 'conversation';

export const STORE_KEYS: Record<PersistedStoreId, string> = {
  ui: 'ui-store',
  context: 'context-store',
  settings: 'settings-store',
  conversation: 'conversation-store',
};

export interface PersistedStoreWrapper<T> {
  version: number;
  data: T;
  updatedAt: number;
}

export const defaultSettings: Settings = {
  providers: [],
  prompts: [
    {
      id: 'default-summary',
      name: '总结',
      content: '请总结以下内容，保留核心观点。',
      mode: 'chat',
    },
  ],
  exportConfig: {
    format: 'markdown',
    includeApiKeys: false,
    autoBackupEnabled: false,
  },
  rssConfig: {
    enabled: false,
    fetchIntervalMinutes: 60,
    maxItemsPerFeed: 50,
    aiSummaryEnabled: false,
  },
  ui: {
    theme: 'system',
    sidebarWidth: 280,
  },
};
