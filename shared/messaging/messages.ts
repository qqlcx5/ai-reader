/**
 * Cross-context message types.
 *
 * The message protocol is intentionally small and string-literal
 * based; the union of `type` × `payload` is what gives us type
 * safety when wiring up handlers. Adding a new message means
 * adding a member to both `MessageType` and `MessagePayload`.
 */

import type { CapturedDocument, ChatHistory, ChatMessage, ModelProviderConfig, AppSettings, SearchResult, WebDAVConfig } from '@db/schema'

export type MessageType =
  | 'CAPTURE_PAGE'
  | 'CAPTURE_COMPLETE'
  | 'OPEN_SIDE_PANEL'
  | 'GET_CURRENT_DOCUMENT'
  | 'GET_DOCUMENTS'
  | 'DELETE_DOCUMENT'
  | 'START_CHAT'
  | 'CHAT_MESSAGE'
  | 'CHAT_STREAM_DELTA'
  | 'CHAT_STREAM_DONE'
  | 'CHAT_STREAM_ERROR'
  | 'ABORT_CHAT'
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
  | 'SYNC_PROGRESS'
  | 'GET_SETTINGS'
  | 'UPDATE_SETTINGS'
  | 'GET_MODEL_CONFIGS'
  | 'UPDATE_MODEL_CONFIGS'
  | 'PING'
  | 'PONG'

export interface MessagePayload {
  // Capture
  CAPTURE_PAGE: { url?: string }
  CAPTURE_COMPLETE: { document: CapturedDocument }
  OPEN_SIDE_PANEL: { documentId?: string }
  GET_CURRENT_DOCUMENT: { documentId?: string }
  GET_DOCUMENTS: { limit?: number; offset?: number }
  DELETE_DOCUMENT: { id: string }

  // Chat
  START_CHAT: {
    documentId: string
    question: string
    modelId?: string
    historyId?: string
  }
  CHAT_MESSAGE: { sessionId: string; message: string }
  CHAT_STREAM_DELTA: { sessionId: string; delta: string; messageId: string }
  CHAT_STREAM_DONE: { sessionId: string; messageId: string; message: ChatMessage }
  CHAT_STREAM_ERROR: { sessionId: string; error: string }
  ABORT_CHAT: { sessionId: string }

  // Search
  SEARCH_QUERY: { query: string; limit?: number }
  SEARCH_RESULTS: { query: string; results: SearchResult[] }
  INDEX_READY: { documentCount: number }
  INDEX_STATUS: { ready: boolean; documentCount: number }
  GET_INDEX_STATUS: Record<string, never>
  UPSERT_DOCUMENT: { documentId: string; document?: CapturedDocument }
  REMOVE_DOCUMENT: { documentId: string }

  // Sync
  SYNC_UPLOAD: { force?: boolean }
  SYNC_DOWNLOAD: { force?: boolean }
  SYNC_STATUS: { isSyncing: boolean; lastSyncAt?: number; lastError?: string }
  SYNC_PROGRESS: { stage: 'reading' | 'packing' | 'uploading' | 'done' | 'error'; percent?: number; error?: string }

  // Settings
  GET_SETTINGS: Record<string, never>
  UPDATE_SETTINGS: { updates: Partial<AppSettings> }
  GET_MODEL_CONFIGS: Record<string, never>
  UPDATE_MODEL_CONFIGS: { configs: ModelProviderConfig[] }

  // Heartbeat
  PING: Record<string, never>
  PONG: Record<string, never>
}

export interface Message<T extends MessageType = MessageType> {
  type: T
  payload: MessagePayload[T]
  requestId?: string
  timestamp?: number
}

export interface MessageResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

/** Lightweight content-script → page-injected UI payload. */
export interface FloatingCapturePayload {
  tabId?: number
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
}

/** Re-export commonly-used types for callers. */
export type { CapturedDocument, ChatHistory, ChatMessage, ModelProviderConfig, AppSettings, SearchResult, WebDAVConfig }
