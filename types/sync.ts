import type { DocumentEntity } from './document'
import type { ConversationEntity } from './chat'
import type { ModelConfig } from './model'
import type { AppSettings } from './settings'
import type { CollectionEntity, CollectionItemEntity } from './collection'
import type { FeedEntity } from './feed'
import type { PromptTemplate } from './prompt-template'

/** Device-local WebDAV connection config. Never synced across devices. */
export interface WebDAVConfig {
  url: string
  username: string
  password: string
  basePath: string
  enabled: boolean
  /** Max timestamped backup snapshots to keep on the remote (default 10). */
  maxBackups?: number
}

/** A timestamped remote backup snapshot, newest-first by `ts`. */
export interface BackupEntry {
  name: string
  ts: number
}

export type EntityKey =
  | 'documents'
  | 'conversations'
  | 'models'
  | 'collections'
  | 'collectionItems'
  | 'settings'
  | 'feeds'
  | 'promptTemplates'
  | 'webdavConfig'
  | 's3Config'

/** A single row from the kvMeta key-value store. */
export interface KvMetaRow {
  id: string
  value: unknown
  updatedAt?: string
}

/** The dataset that participates in sync. */
export interface SyncedDataset {
  documents: DocumentEntity[]
  conversations: ConversationEntity[]
  models: ModelConfig[]
  collections: CollectionEntity[]
  collectionItems: CollectionItemEntity[]
  settings: AppSettings[]
  feeds: FeedEntity[]
  promptTemplates: PromptTemplate[]
  webdavConfig: KvMetaRow[]
  s3Config: KvMetaRow[]
}

export interface RemoteSnapshot {
  version: number
  syncedAt: string
  data: SyncedDataset
}

/** id → version string (updatedAt / addedAt) */
export type VersionMap = Record<string, string>
export type SyncVersions = Record<EntityKey, VersionMap>

/** Device-local sync state: the "base" = versions as of the last successful sync. */
export interface SyncState {
  id: 'sync-state'
  lastSyncAt: string
  lastError?: string
  base: SyncVersions
}

export interface SyncResult {
  pulled: number
  pushed: number
  deletedLocal: number
  deletedRemote: number
  conflicts: number
}

export interface SyncDeleteItem {
  type: EntityKey
  id: string
  label?: string
}

/** A single conflicting item with details about what diverged. */
export interface SyncConflictItem {
  type: EntityKey
  id: string
  label?: string
  localVersion: string
  remoteVersion: string
  /** Which side won the merge: 'local' or 'remote'. */
  chosen: 'local' | 'remote'
}

/** How to resolve real conflicts (both sides changed since base). */
export type ConflictResolution = 'lww' | 'local' | 'remote'

/** A pulled/pushed item with its label for preview detail. */
export interface SyncChangeItem {
  type: EntityKey
  id: string
  label?: string
}

/**
 * Dry-run preview of a sync: counts, totals, and labelled items so
 * the UI can show exactly what would happen before applying anything.
 * `abortReason` is set when a wipe safeguard would trigger.
 */
export interface SyncPreview {
  pulled: number
  pushed: number
  deletedLocal: number
  deletedRemote: number
  conflicts: number
  localTotal: number
  remoteTotal: number
  abortReason?: string
  localDeleteItems: SyncDeleteItem[]
  remoteDeleteItems: SyncDeleteItem[]
  conflictItems: SyncConflictItem[]
  pullItems: SyncChangeItem[]
  pushItems: SyncChangeItem[]
  /** The resolution strategy used to produce this preview. */
  resolution: ConflictResolution
}
