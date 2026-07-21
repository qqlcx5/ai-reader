export const DB_VERSION = 13

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
  aiJobs: 'id, documentId, status, createdAt, batchId, priority, workflowRunId',
  // Reusable multi-step analysis pipelines. Local-only.
  workflows: 'id, enabled, createdAt',
  // Cron-triggered auto-analysis plans. Local-only.
  schedules: 'id, enabled, lastFiredAt',
  // Condition-based rules that override default model/template selection
  // for auto-analysis. Local-only.
  analysisRules: 'id, enabled, createdAt',
} as const
