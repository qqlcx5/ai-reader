export const DB_VERSION = 10

export const STORE_MAP = {
  documents: 'id, url, canonicalUrl, title, siteName, capturedAt, updatedAt, lastOpenedAt, readProgress, contentHash',
  conversations: 'id, documentId, createdAt, updatedAt',
  models: 'id, provider, modelId, enabled, isDefault, updatedAt, lastUsedAt',
  settings: 'id, updatedAt',
  promptTemplates: 'id, category, isBuiltin, sortOrder, createdAt',
  collections: 'id, name, createdAt, updatedAt',
  collectionItems: 'id, collectionId, documentId, order, [collectionId+order], [collectionId+documentId]',
  // Device-local meta (WebDAV config, sync state). Keyed by id, never synced.
  kvMeta: 'id',
  // RSS subscriptions (synced) and items (local-only, re-fetched per device).
  feeds: 'id, url, folder, lastFetchedAt, updatedAt',
  feedItems: 'id, feedId, guid, [feedId+publishedAt], readAt, documentId',
  // Background auto-analysis jobs (panel-drained queue). Local-only.
  aiJobs: 'id, documentId, status, createdAt, batchId, priority',
} as const
