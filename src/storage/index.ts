/**
 * M7 Storage & Data Layer — Unified Export
 *
 * Provides:
 * - Dexie database (conversations, messages, RSS, workflow templates)
 * - Repository layer for CRUD operations
 * - Chunk cache for large text transfers
 * - Web Worker full-text search
 * - Pinia ↔ chrome.storage sync helpers
 *
 * Based on design-07-storage-data.md.
 */

// ─── Database ────────────────────────────────────────────────────────

export { AiReaderDB, getDb, resetDbForTests, Dexie } from './db';

// ─── Repositories ────────────────────────────────────────────────────

export { ConversationRepository, conversationRepo } from './repositories/conversation.repo';
export { MessageRepository, messageRepo } from './repositories/message.repo';

// ─── Chunk Cache ─────────────────────────────────────────────────────

export { SessionChunkCache, chunkCache } from './chunk-cache';

// ─── Search ──────────────────────────────────────────────────────────

export {
  searchMessagesInWorker,
  searchAllMessages,
  terminateSearchWorker,
} from './search.service';

// ─── Settings Persistence ────────────────────────────────────────────

export {
  saveSettings,
  loadSettings,
  saveUiState,
  loadUiState,
  saveContext,
  loadContext,
  onStorageChange,
} from './persisted-state';

// ─── Types ───────────────────────────────────────────────────────────

export type {
  ConversationRecord,
  MessageRecord,
  ModelResponse,
  ConversationMode,
  MessageRole,
  RssItemRecord,
  RssFeedRecord,
  WorkflowTemplateRecord,
  WorkflowNode,
  WorkflowStatus,
  WorkflowNodeStatus,
  ProviderConfig,
  PromptTemplate,
  ExportConfig,
  RssConfig,
  UiSettings,
  Settings,
  CurrentContext,
  ContextMode,
  UiState,
  SearchResult,
  SearchWorkerPayload,
  SearchWorkerResponse,
  ChunkCacheAPI,
  PaginationOptions,
  PageResult,
  PersistedStoreId,
  PersistedStoreWrapper,
} from './types';

export {
  STORE_KEYS,
  defaultSettings,
} from './types';
