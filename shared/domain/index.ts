// ============================================================
// SuperBrain Domain Types
// ============================================================

// ---- Core Entities ----

export interface SavedArticle {
  id: string;
  title: string;
  url: string;
  siteName: string;
  author: string;
  publishedAt: string;
  excerpt: string;
  markdown: string;
  contentHtml: string;
  contentText: string;
  faviconUrl: string;
  image: string;
  readingTime: number; // minutes
  createdAt: string;   // ISO 8601
  updatedAt: string;   // ISO 8601
}

export interface PageMetadata {
  title: string;
  url: string;
  siteName: string;
  author: string;
  publishedAt: string;
  description: string;
  faviconUrl: string;
  lang: string;
}

export interface ExtractResult {
  title: string;
  url: string;
  siteName: string;
  author: string;
  publishedAt: string;
  excerpt: string;
  contentHtml: string;
  contentText: string;
  image: string;
  readingTime: number;
}

// ---- App Settings ----

export interface AppSettings {
  autoSave: boolean;
  showToast: boolean;
  includeFrontmatter: boolean;
  readerStyle: 'light' | 'dark' | 'sepia';
}

// ---- Toast ----

export interface ToastState {
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  description: string;
  duration: number; // ms
}

// ---- Capture Flow ----

export type CaptureStep =
  | 'idle'
  | 'extracting'
  | 'markdown'
  | 'saving'
  | 'success'
  | 'error';

// ---- Error Codes ----

export enum AppErrorCode {
  UNKNOWN = 'UNKNOWN',
  EXTRACTION_FAILED = 'EXTRACTION_FAILED',
  MARKDOWN_PARSE_ERROR = 'MARKDOWN_PARSE_ERROR',
  SAVE_FAILED = 'SAVE_FAILED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  STORAGE_FULL = 'STORAGE_FULL',
  INVALID_URL = 'INVALID_URL',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  CONTENT_SCRIPT_TIMEOUT = 'CONTENT_SCRIPT_TIMEOUT',
}

// ---- Model Management ----

export interface ModelProvider {
  id: string;
  name: string;
  baseUrl: string;
  models: string[];
  isBuiltin: boolean;
  createdAt: string;
}

export interface ModelConfig {
  providerId: string;
  providerName: string;
  modelName: string;
  baseUrl: string;
}

export interface ModelConfigFull extends ModelConfig {
  apiKey: string; // plaintext — only in memory, never persisted directly
}

export interface StoredProviderConfig {
  providerId: string;
  providerName: string;
  modelName: string;
  baseUrl: string;
  isActive: boolean;
  updatedAt: string;
}

export interface ModelConnectionStatus {
  providerId: string;
  providerName: string;
  modelName: string;
  connected: boolean;
  latencyMs: number | null;
  error?: string;
  checkedAt: string;
}

// ---- Messaging ----

export type MessageAction =
  | { action: 'ping'; data?: never }
  | { action: 'EXTRACT_PAGE'; data: { url?: string } }
  | { action: 'GET_PAGE_METADATA'; data?: never }
  | { action: 'CAPTURE_PROGRESS'; data: { step: CaptureStep; error?: AppErrorCode; progress?: number } }
  | { action: 'saveArticle'; data: SavedArticle }
  | { action: 'getArticle'; data: { id: string } }
  | { action: 'deleteArticle'; data: { id: string } }
  | { action: 'getSettings'; data?: never }
  | { action: 'updateSettings'; data: Partial<AppSettings> };

export interface MessageEnvelope<T = unknown> {
  type: string;
  payload: T;
  timestamp: number;
}

export type MessageHandler<T = unknown> = (
  payload: T,
  sender: chrome.runtime.MessageSender,
) => Promise<unknown> | unknown;
