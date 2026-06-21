/**
 * M7 Storage & Data Layer — Shared types
 *
 * All data structures used across the storage layer: Dexie tables,
 * Pinia store shapes, search/chunk-cache interfaces, and default settings.
 *
 * Based on design-07-storage-data.md.
 */

// ─── Conversation / Message ──────────────────────────────────────────

export type ConversationMode = 'chat' | 'roundtable' | 'relay';

export type MessageRole = 'user' | 'assistant' | 'system';

export interface ModelResponse {
  providerId: string;
  modelId?: string;
  content: string;
  metrics?: {
    inputTokens?: number;
    outputTokens?: number;
    latencyMs?: number;
    tokensPerSecond?: number;
    cost?: number;
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
  messageCount: number;
  preview: string;
  rootMessageId?: string;
}

export interface MessageRecord {
  id: string;
  conversationId: string;
  parentId?: string;
  role: MessageRole;
  content?: string;
  modelResponses: ModelResponse[];
  createdAt: number;
}

// ─── RSS ─────────────────────────────────────────────────────────────

export interface RssItemRecord {
  id: string;
  feedId: string;
  title?: string;
  pubDate: number;
  isRead: boolean;
  hash: string;
  content?: string;
  url?: string;
  aiSummary?: string;
  isSummarized: boolean;
}

export interface RssFeedRecord {
  id: string;
  url: string;
  enabled: boolean;
  lastFetchedAt: number;
  title?: string;
  refreshIntervalMinutes?: number;
  lastError?: { code: string; message: string; at: number };
}

// ─── Workflow ────────────────────────────────────────────────────────

export interface WorkflowNode {
  id: string;
  order: number;
  name: string;
  providerId: string;
  systemPrompt: string;
  upstreamNodeIds: string[];
}

export type WorkflowStatus = 'idle' | 'running' | 'paused' | 'done' | 'error';
export type WorkflowNodeStatus = 'pending' | 'running' | 'done' | 'error' | 'aborted';

export interface WorkflowTemplateRecord {
  id: string;
  name: string;
  type: 'roundtable' | 'relay';
  description?: string;
  nodes: WorkflowNode[];
  createdAt: number;
  updatedAt: number;
  builtIn: boolean;
}

// ─── Settings ────────────────────────────────────────────────────────

export interface ProviderConfig {
  id: string;
  name: string;
  type: 'openai' | 'anthropic' | 'gemini' | 'custom';
  apiKey: string;
  baseUrl?: string;
  defaultModel?: string;
  enabled?: boolean;
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
  autoBackupHour?: number;
  autoBackupMinute?: number;
  webDAVUrl?: string;
  webDAVUsername?: string;
  webDAVPassword?: string;
  webDAVBackupPath?: string;
  obsidianVault?: string;
  obsidianFolder?: string;
  lastBackupAt?: number;
  lastBackupError?: string;
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

// ─── Context ─────────────────────────────────────────────────────────

export type ContextMode = 'summary' | 'full' | 'selected' | 'relay';

export interface CurrentContext {
  title: string;
  url: string;
  excerpt: string;
  fullText: string;
  readabilityHtml: string;
  rawText: string;
  mode: ContextMode;
  transferId?: string;
  anchor?: string;
}

// ─── UI State ────────────────────────────────────────────────────────

export interface UiState {
  activePanel: 'chat' | 'history' | 'rss' | 'settings';
  sidebarCollapsed: boolean;
  showTokenMetrics: boolean;
  selectedConversationId?: string;
  selectedFeedId?: string;
  historySearchKeyword: string;
  deepSearchResults?: SearchResult[];
}

// ─── Search ──────────────────────────────────────────────────────────

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

// ─── Chunk Cache ─────────────────────────────────────────────────────

export interface ChunkCacheAPI {
  setTransferMeta(id: string, meta: { totalChunks: number; totalSize: number }): Promise<void>;
  setChunk(id: string, index: number, data: string): Promise<void>;
  getAllChunks(id: string): Promise<string[]>;
  clearTransfer(id: string): Promise<void>;
}

// ─── Pagination ─────────────────────────────────────────────────────

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

// ─── Pinia Persistence ──────────────────────────────────────────────

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

// ─── Defaults ───────────────────────────────────────────────────────

export const defaultSettings: Settings = {
  providers: [],
  prompts: [
    {
      id: 'default-summary',
      name: 'Summary',
      content: '请总结以下内容，保留核心观点。',
      mode: 'chat',
    },
    {
      id: 'default-explain',
      name: 'Explain',
      content: '请用通俗易懂的语言解释以下内容。',
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
