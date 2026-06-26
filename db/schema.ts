/**
 * Database schema definitions for AI Reader.
 *
 * These TypeScript interfaces define the shape of records persisted
 * to IndexedDB. The actual Dexie table indexes live in `dexie.ts`.
 *
 * `CURRENT_SCHEMA_VERSION` is the source of truth for the on-disk
 * schema and must be bumped (with a migration) whenever the shape
 * of any persisted record changes incompatibly.
 */

import type { ChatMessage } from './chat'
import type { CapturedDocument } from './document'
import type { ModelProviderConfig } from './model'

// ===================== Document =====================

export type { CapturedDocument, DocumentMetadata } from './document'
export type { ChatMessage, ChatHistory, ChatHistoryMessage } from './chat'
export type { ModelProviderConfig, WebDAVConfig, SyncConfig, AppSettings } from './model'

// ===================== Search =====================

/**
 * Single hit returned by the local search index (MiniSearch).
 *
 * The shape is intentionally close to what the worker already
 * produces: a `documentId`/`score` pair plus a pre-rendered
 * snippet (`match`) that the side panel can render without
 * re-scanning the original markdown.
 */
export interface SearchResult {
  documentId: string
  /** The captured document. Only `DocumentMetadata` fields are
   *  guaranteed — heavy fields (`markdownContent`, `rawHtml`)
   *  are stripped before crossing the worker boundary. */
  document: import('./document').DocumentMetadata
  /** Relevance score reported by MiniSearch (higher is better). */
  score: number
  /** Short snippet with the matched terms highlighted, if any. */
  match: string
}

// ===================== Settings entry =====================

/**
 * Generic settings entry stored in the `settings` Dexie table.
 * Values are typed as `unknown` at the storage layer and narrowed
 * by the caller; this keeps the schema flexible.
 */
export interface SettingsEntry<T = unknown> {
  key: string
  value: T
  updatedAt: number
}

// ===================== Backwards-compatible aliases =====================

/**
 * Aliases retained for compatibility with earlier code paths that
 * used different names. New code should import from the source
 * modules instead.
 */
export type ChatSession = ChatHistory
export type ModelConfig = ModelProviderConfig
export type WebDAVSyncConfig = WebDAVConfig

// ===================== Backup format =====================

/**
 * Format of the JSON file produced by `core/sync/backup-packager.ts`.
 * `schemaVersion` lets us reject backups produced by an incompatible
 * future build.
 */
export interface BackupBundle {
  schemaVersion: number
  version: string
  exportedAt: number
  documents: CapturedDocument[]
  chatHistories: ChatHistory[]
  settings: SettingsEntry[]
}

// ===================== Schema version =====================

/**
 * Bump this whenever the on-disk shape of any persisted record
 * changes in a backward-incompatible way. Migrations live in
 * `db/migrations.ts`.
 */
export const CURRENT_SCHEMA_VERSION = 1
