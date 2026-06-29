export const DB_VERSION = 4

export const STORE_MAP = {
  documents: 'id, url, canonicalUrl, title, siteName, capturedAt, updatedAt, lastOpenedAt, contentHash',
  conversations: 'id, documentId, createdAt, updatedAt',
  models: 'id, provider, modelId, enabled, isDefault, updatedAt, lastUsedAt',
  settings: 'id, updatedAt',
  promptTemplates: 'id, category, isBuiltin, sortOrder, createdAt',
  collections: 'id, name, createdAt, updatedAt',
  collectionItems: 'id, collectionId, documentId, order, [collectionId+order], [collectionId+documentId]',
} as const
