/**
 * Search worker.
 *
 * Owns the in-memory MiniSearch index for the local
 * "captured document" corpus. Communicates with the main
 * thread (the MV3 service worker / `core/search/search.service`)
 * over a structured `postMessage` protocol.
 *
 * Messages received (input):
 *   - `INIT_INDEX`        — replace the index with the given documents
 *   - `UPSERT_DOCUMENT`   — add or update a single document by id
 *   - `REMOVE_DOCUMENT`   — drop a single document by id
 *   - `SEARCH_QUERY`      — run a query, reply with `SEARCH_RESULTS`
 *   - `GET_STATUS`        — reply with `INDEX_STATUS`
 *
 * Messages sent (output):
 *   - `INDEX_READY`       — broadcast when the index is populated
 *   - `SEARCH_RESULTS`    — reply to a `SEARCH_QUERY`
 *   - `INDEX_STATUS`      — reply to a `GET_STATUS`
 *
 * Implementation notes:
 *   - The worker is loaded with Vite's `?worker` import. This
 *     means we can use ES module imports and shared types from
 *     `@db/schema`.
 *   - MiniSearch v7 ships an `Index` serializer, but we keep the
 *     index fully in memory; rebuilds are O(n) and fast enough
 *     for the expected document count (a few thousand).
 *   - We only index the `title` and `markdownContent` fields;
 *     the rest of the document is kept in `storeFields` so the
 *     search results can render the document card without an
 *     extra round-trip to the database.
 */

import MiniSearch from 'minisearch'
import type { CapturedDocument, SearchResult } from '@db/schema'

/* ----------------------------------------------------------------
 * Message protocol (mirrors `shared/messaging/messages.ts`)
 * ---------------------------------------------------------------- */

export interface WorkerInputMap {
  INIT_INDEX: { documents: CapturedDocument[] }
  UPSERT_DOCUMENT: { documentId: string; document?: CapturedDocument }
  REMOVE_DOCUMENT: { documentId: string }
  SEARCH_QUERY: { query: string; limit?: number; requestId?: string }
  GET_STATUS: Record<string, never>
}

export interface WorkerOutputMap {
  INDEX_READY: { documentCount: number }
  SEARCH_RESULTS: { query: string; results: SearchResult[]; requestId?: string }
  INDEX_STATUS: { documentCount: number; ready: boolean }
}

export type WorkerInputMessage<K extends keyof WorkerInputMap = keyof WorkerInputMap> = {
  type: K
  payload: WorkerInputMap[K]
}

export type WorkerOutputMessage =
  | { type: 'INDEX_READY'; payload: WorkerOutputMap['INDEX_READY'] }
  | { type: 'SEARCH_RESULTS'; payload: WorkerOutputMap['SEARCH_RESULTS'] }
  | { type: 'INDEX_STATUS'; payload: WorkerOutputMap['INDEX_STATUS'] }

/* ----------------------------------------------------------------
 * Document projection
 * ---------------------------------------------------------------- */

/** Strip `markdownContent` / `rawHtml` / `schemaOrgData` etc. so
 *  the result payload stays small when sent across the boundary. */
function toMetadata(doc: CapturedDocument): CapturedDocument {
  // DocumentMetadata is structural — we just return the document
  // as-is because CapturedDocument is a superset and the consumer
  // only reads the metadata fields. Storing the heavy text on
  // the side panel side would defeat the purpose of the worker
  // cache, so we strip it here.
  return {
    id: doc.id,
    url: doc.url,
    title: doc.title,
    description: doc.description,
    author: doc.author,
    publishedAt: doc.publishedAt,
    siteName: doc.siteName,
    favicon: doc.favicon,
    image: doc.image,
    wordCount: doc.wordCount,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  }
}

/* ----------------------------------------------------------------
 * MiniSearch configuration
 * ---------------------------------------------------------------- */

interface IndexedDocument {
  id: string
  title: string
  markdownContent: string
  // Stored fields (kept in the index for fast retrieval):
  url: string
  createdAt: number
  updatedAt: number
  description: string
  siteName: string
  author: string
  favicon: string
}

function projectForIndex(doc: CapturedDocument): IndexedDocument {
  return {
    id: doc.id,
    title: doc.title,
    markdownContent: doc.markdownContent,
    url: doc.url,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    description: doc.description ?? '',
    siteName: doc.siteName ?? '',
    author: doc.author ?? '',
    favicon: doc.favicon ?? '',
  }
}

function createIndex(): MiniSearch<IndexedDocument> {
  return new MiniSearch<IndexedDocument>({
    fields: ['title', 'markdownContent'],
    storeFields: [
      'id',
      'url',
      'title',
      'createdAt',
      'updatedAt',
      'description',
      'siteName',
      'author',
      'favicon',
    ],
    searchOptions: {
      boost: { title: 3, markdownContent: 1 },
      prefix: true,
      fuzzy: 0.2,
      combineWith: 'AND',
    },
  })
}

/* ----------------------------------------------------------------
 * In-memory document cache (so UPSERT doesn't need a DB hit on
 * the worker side; the main thread always passes the full
 * `CapturedDocument`).
 * ---------------------------------------------------------------- */

const documentCache = new Map<string, CapturedDocument>()
let miniSearch: MiniSearch<IndexedDocument> = createIndex()
let documentCount = 0

/* ----------------------------------------------------------------
 * Helpers
 * ---------------------------------------------------------------- */

function indexDocument(doc: CapturedDocument): void {
  const projected = projectForIndex(doc)
  if (miniSearch.has(doc.id)) {
    miniSearch.replace(projected)
  } else {
    miniSearch.add(projected)
  }
  documentCache.set(doc.id, doc)
  documentCount = documentCache.size
}

function removeDocument(id: string): boolean {
  if (!miniSearch.has(id)) return false
  miniSearch.discard(id)
  documentCache.delete(id)
  documentCount = documentCache.size
  return true
}

function indexDocuments(docs: CapturedDocument[]): void {
  miniSearch = createIndex()
  documentCache.clear()
  for (const doc of docs) {
    indexDocument(doc)
  }
}

/** Build a `SearchResult` from a MiniSearch hit. */
function hitToResult(
  hit: { id: string; score: number; match: Record<string, string[]> },
  doc: CapturedDocument
): SearchResult {
  // We don't pre-compute the snippet here — the main thread has
  // a faster path using the cached full document. Leave `match`
  // as a placeholder; the service layer will overwrite it with
  // the highlighted snippet.
  const matchedTerms = Object.values(hit.match ?? {})
    .flat()
    .filter((t) => typeof t === 'string' && t.length > 0)
  return {
    documentId: hit.id,
    document: toMetadata(doc),
    score: hit.score,
    match: matchedTerms.length > 0 ? matchedTerms[0]! : doc.title,
  }
}

function postMessage(message: WorkerOutputMessage): void {
  ;(self as unknown as Worker).postMessage(message)
}

/* ----------------------------------------------------------------
 * Handlers
 * ---------------------------------------------------------------- */

function handleInit(payload: { documents: CapturedDocument[] }): void {
  indexDocuments(payload.documents)
  postMessage({ type: 'INDEX_READY', payload: { documentCount } })
}

function handleUpsert(
  payload: { documentId: string; document?: CapturedDocument },
  fetcher: DocumentFetcher
): void {
  // Preferred path: the main thread ships the full document
  // along with the id, so the worker is stateless.
  const incoming = payload.document
  const doc = incoming ?? fetcher(payload.documentId)
  if (!doc) {
    // Document was deleted between request and fetch; ignore.
    return
  }
  indexDocument(doc)
}

function handleRemove(payload: { documentId: string }): void {
  removeDocument(payload.documentId)
}

function handleSearch(payload: { query: string; limit?: number; requestId?: string }): void {
  const { query, limit = 50, requestId } = payload
  const trimmed = query.trim()
  if (trimmed.length === 0) {
    postMessage({ type: 'SEARCH_RESULTS', payload: { query, results: [], requestId } })
    return
  }
  let hits: Array<{ id: string; score: number; match: Record<string, string[]> }>
  try {
    hits = miniSearch.search(trimmed) as unknown as Array<{
      id: string
      score: number
      match: Record<string, string[]>
    }>
  } catch (err) {
    // Malformed regex (e.g. unbalanced bracket) — MiniSearch
    // throws, so we degrade gracefully to an empty result.
    if (typeof console !== 'undefined') {
      console.warn('[search.worker] query failed:', err)
    }
    postMessage({ type: 'SEARCH_RESULTS', payload: { query, results: [], requestId } })
    return
  }
  const sliced = hits.slice(0, limit)
  const results: SearchResult[] = []
  for (const hit of sliced) {
    const doc = documentCache.get(hit.id)
    if (!doc) continue
    results.push(hitToResult(hit, doc))
  }
  postMessage({ type: 'SEARCH_RESULTS', payload: { query, results, requestId } })
}

function handleStatus(): void {
  postMessage({ type: 'INDEX_STATUS', payload: { documentCount, ready: true } })
}

/* ----------------------------------------------------------------
 * Document fetcher
 *
 * The worker can't reach the main Dexie instance, so it relies
 * on the main thread (search.service) to provide the actual
 * `CapturedDocument` whenever an UPSERT comes in. We abstract
 * this behind a small interface so tests can inject a fake.
 * ---------------------------------------------------------------- */

export interface DocumentFetcher {
  (documentId: string): CapturedDocument | undefined
}

let documentFetcher: DocumentFetcher = () => undefined

export function _setDocumentFetcherForTests(fetcher: DocumentFetcher): void {
  documentFetcher = fetcher
}

/* ----------------------------------------------------------------
 * Boot — register a single `onmessage` listener and route by
 * `type`.
 * ---------------------------------------------------------------- */

function onMessage(event: MessageEvent<WorkerInputMessage>): void {
  const { type, payload } = event.data
  switch (type) {
    case 'INIT_INDEX':
      handleInit(payload as WorkerInputMap['INIT_INDEX'])
      break
    case 'UPSERT_DOCUMENT':
      handleUpsert(payload as WorkerInputMap['UPSERT_DOCUMENT'], documentFetcher)
      break
    case 'REMOVE_DOCUMENT':
      handleRemove(payload as WorkerInputMap['REMOVE_DOCUMENT'])
      break
    case 'SEARCH_QUERY':
      handleSearch(payload as WorkerInputMap['SEARCH_QUERY'])
      break
    case 'GET_STATUS':
      handleStatus()
      break
    default: {
      // Exhaustiveness check.
      const _exhaustive: never = type
      void _exhaustive
    }
  }
}

;(self as unknown as Worker).addEventListener('message', onMessage)

// Re-export the message types for tests that import the worker
// source directly.
export type { CapturedDocument, SearchResult }
