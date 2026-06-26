// ==================== Document Types ====================

export interface CapturedDocument {
  id: string;
  url: string;
  title: string;
  description?: string;
  author?: string;
  publishedDate?: string;
  siteName?: string;
  favicon?: string;
  content: string;
  rawHtml?: string;
  markdown?: string;
  capturedAt: number;
  updatedAt?: number;
  wordCount?: number;
  readingTime?: number;
  tags?: string[];
  isArchived?: boolean;
}

export interface DocumentMetadata {
  url: string;
  title: string;
  description?: string;
  author?: string;
  publishedDate?: string;
  siteName?: string;
  favicon?: string;
  wordCount?: number;
  readingTime?: number;
}

// ==================== Chat Types ====================

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  model?: string;
  tokens?: number;
  isStreaming?: boolean;
  error?: string;
}

export interface ChatSession {
  id: string;
  documentId: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
  modelId?: string;
  systemPrompt?: string;
}

// ==================== Model Types ====================

export interface ModelConfig {
  id: string;
  name: string;
  provider: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  enabled: boolean;
  isDefault?: boolean;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}

export interface ModelProvider {
  id: string;
  name: string;
  baseUrl: string;
  apiKeyRequired: boolean;
  models: string[];
  defaultModel?: string;
}

// ==================== Search Types ====================

export interface SearchResult {
  document: CapturedDocument;
  score: number;
  match: string;
}

export interface SearchIndexEntry {
  id: string;
  title: string;
  content: string;
  url: string;
  capturedAt: number;
}

// ==================== Sync Types ====================

export interface WebDAVConfig {
  enabled: boolean;
  url: string;
  username: string;
  password: string;
  syncInterval?: number;
  lastSyncAt?: number;
}

export interface SyncStatus {
  isSyncing: boolean;
  lastSyncAt?: number;
  lastSyncResult?: 'success' | 'error';
  lastSyncError?: string;
  pendingChanges: number;
}

// ==================== Settings Types ====================

export interface AppSettings {
  theme: 'light' | 'dark' | 'auto';
  language: string;
  defaultModelId?: string;
  autoCapture: boolean;
  showFloatingButton: boolean;
  floatingButtonPosition: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  sidePanelWidth?: number;
  defaultSystemPrompt?: string;
}

// ==================== Timeline Types ====================

export interface TimelineEntry {
  date: string;
  documents: CapturedDocument[];
  count: number;
}

export interface TimelineStats {
  totalDocuments: number;
  totalWords: number;
  averageReadingTime: number;
  topSites: { site: string; count: number }[];
  dailyAverage: number;
}

// ==================== Message Types ====================

export type MessageType =
  | 'CAPTURE_PAGE'
  | 'CAPTURE_COMPLETE'
  | 'START_CHAT'
  | 'CHAT_MESSAGE'
  | 'CHAT_STREAM'
  | 'SEARCH_QUERY'
  | 'SEARCH_RESULTS'
  | 'INDEX_READY'
  | 'INDEX_STATUS'
  | 'GET_INDEX_STATUS'
  | 'UPSERT_DOCUMENT'
  | 'REMOVE_DOCUMENT'
  | 'SYNC_UPLOAD'
  | 'SYNC_DOWNLOAD'
  | 'SYNC_STATUS'
  | 'OPEN_SIDE_PANEL'
  | 'GET_CURRENT_DOCUMENT'
  | 'GET_DOCUMENTS'
  | 'DELETE_DOCUMENT'
  | 'UPDATE_DOCUMENT'
  | 'PING'
  | 'PONG';

export interface MessagePayload {
  CAPTURE_PAGE: { url?: string };
  CAPTURE_COMPLETE: { document: CapturedDocument };
  START_CHAT: { documentId: string; message?: string };
  CHAT_MESSAGE: { sessionId: string; message: string };
  CHAT_STREAM: { sessionId: string; chunk: string; done: boolean };
  SEARCH_QUERY: { query: string; limit?: number };
  SEARCH_RESULTS: { query: string; results: SearchResult[] };
  INDEX_READY: { documentCount: number };
  INDEX_STATUS: { ready: boolean; documentCount: number };
  GET_INDEX_STATUS: Record<string, never>;
  UPSERT_DOCUMENT: { documentId: string; document?: CapturedDocument };
  REMOVE_DOCUMENT: { documentId: string };
  SYNC_UPLOAD: { force?: boolean };
  SYNC_DOWNLOAD: { force?: boolean };
  SYNC_STATUS: { status: SyncStatus };
  OPEN_SIDE_PANEL: { documentId?: string };
  GET_CURRENT_DOCUMENT: {};
  GET_DOCUMENTS: { limit?: number; offset?: number };
  DELETE_DOCUMENT: { id: string };
  UPDATE_DOCUMENT: { id: string; updates: Partial<CapturedDocument> };
  PING: {};
  PONG: {};
}

export interface Message<T extends MessageType = MessageType> {
  type: T;
  payload: MessagePayload[T];
  requestId?: string;
  timestamp?: number;
}

export interface MessageResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}
