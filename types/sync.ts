import type { DocumentEntity } from './document'
import type { ConversationEntity } from './chat'
import type { ModelConfig } from './model'
import type { AppSettings } from './settings'
import type { CollectionEntity, CollectionItemEntity } from './collection'
import type { FeedEntity } from './feed'

/** Device-local WebDAV connection config. Never synced across devices. */
export interface WebDAVConfig {
  url: string
  username: string
  password: string
  basePath: string
  enabled: boolean
}

export type EntityKey =
  | 'documents'
  | 'conversations'
  | 'models'
  | 'collections'
  | 'collectionItems'
  | 'settings'
  | 'feeds'

/** The dataset that participates in sync. */
export interface SyncedDataset {
  documents: DocumentEntity[]
  conversations: ConversationEntity[]
  models: ModelConfig[]
  collections: CollectionEntity[]
  collectionItems: CollectionItemEntity[]
  settings: AppSettings[]
  feeds: FeedEntity[]
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
