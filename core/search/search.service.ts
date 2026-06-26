/**
 * Search service.
 *
 * The single owner of the search `Worker` instance. Lives in the
 * background context (MV3 service worker) and exposes a small
 * promise-based API to the rest of the codebase:
 *
 *   - `initIndex()`           — rebuild from `documentRepository.listAll()`
 *   - `upsertDocument(id)`    — incrementally add / update
 *   - `removeDocument(id)`    — incrementally remove
 *   - `query(q, limit?)`      — promise that resolves with the
 *                               results once the worker replies
 *   - `getIndexStatus()`      — `{ ready, documentCount }`
 *
 * The service also wires:
 *   - The capture pipeline's `UPSERT_DOCUMENT` broadcast →
 *     `upsertDocument()`.
 *   - The `DELETE_DOCUMENT` message → `removeDocument()`.
 *   - The `SEARCH_QUERY` message → `query()`.
 *   - The `INDEX_READY` worker response → a `broadcast()` so
 *     side panels can show "N documents indexed".
 *
 * For unit tests, the underlying worker is mockable via
 * `setSearchServiceDeps({ ... })`. The tests exercise the
 * orchestration logic without actually spawning a Worker.
 */

import { documentRepository } from '@core/documents/document.repository'
import type { CapturedDocument, SearchResult } from '@db/schema'
import { broadcast, onMessage, sendMessage } from '@shared/messaging/runtime-client'
import { buildSnippet } from './highlight'
import type {
  WorkerInputMap,
  WorkerOutputMessage,
  DocumentFetcher,
} from '../../workers/search.worker'

/* ----------------------------------------------------------------
 * Public types
 * ---------------------------------------------------------------- */

export interface SearchServiceDeps {
  /** Fetcher used by the worker for incremental updates. */
  fetchDocument?: (id: string) => Promise<CapturedDocument | undefined>
  /** Provide a list of every document (used by `initIndex`). */
  listAll?: () => Promise<CapturedDocument[]>
  /** Build a fresh worker (default: Vite `?worker` import). */
  createWorker?: () => WorkerLike
  /** Send messages into the worker (override in tests). */
  postToWorker?: (msg: WorkerInputMessage) => void
  /** Subscribe to messages coming back from the worker. */
  onWorkerMessage?: (handler: (msg: WorkerOutputMessage) => void) => () => void
  /** Broadcast to all extension contexts. */
  broadcast?: (msg: WorkerOutputBroadcast) => void
  /** Snippet builder (override in tests). */
  buildSnippet?: typeof buildSnippet
  /** Generate a synthetic id for outgoing `SEARCH_QUERY` messages. */
  generateRequestId?: () => string
}

/** Minimal subset of the `Worker` API the service depends on. */
export interface WorkerLike {
  postMessage(msg: unknown): void
  addEventListener(type: 'message', listener: (e: MessageEvent) => void): void
  removeEventListener(type: 'message', listener: (e: MessageEvent) => void): void
  terminate?(): void
}

export type WorkerInputMessage = {
  type: keyof WorkerInputMap
  payload: WorkerInputMap[keyof WorkerInputMap]
}

export type WorkerOutputBroadcast =
  | { type: 'INDEX_READY'; payload: { documentCount: number } }
  | { type: 'SEARCH_RESULTS'; payload: { query: string; results: SearchResult[] } }

export interface SearchServiceStatus {
  ready: boolean
  documentCount: number
}

/* ----------------------------------------------------------------
 * Default worker wiring
 * ---------------------------------------------------------------- */

// Vite `?worker` import — at build time Vite bundles the worker
// entrypoint and emits a `Worker` constructor for us. The
// `new URL(...)` form ensures the worker is recognised by Vite
// even when the bundler is in lib mode (vitest).
function defaultCreateWorker(): WorkerLike {
  // The factory is registered by `worker-entrypoint.ts` on the
  // global scope at build time (see `worker-entrypoint.ts`).
  const factory = (globalThis as { __AI_READER_SEARCH_WORKER__?: () => WorkerLike })
    .__AI_READER_SEARCH_WORKER__
  if (typeof factory === 'function') {
    return factory()
  }
  // Fallback: register a fake worker that echoes messages so
  // the rest of the service still functions (e.g. when running
  // unit tests in a plain node context).
  return createInMemoryWorkerStub()
}

function createInMemoryWorkerStub(): WorkerLike {
  const listeners = new Set<(e: MessageEvent) => void>()
  const queue: WorkerOutputMessage[] = []
  return {
    postMessage(msg: unknown) {
      const m = msg as WorkerInputMessage
      if (m?.type === 'INIT_INDEX') {
        const payload = m.payload as { documents: CapturedDocument[] }
        queue.push({
          type: 'INDEX_READY',
          payload: { documentCount: payload.documents.length },
        })
      } else if (m?.type === 'SEARCH_QUERY') {
        const payload = m.payload as { query: string; requestId?: string }
        queue.push({
          type: 'SEARCH_RESULTS',
          payload: { query: payload.query, results: [], requestId: payload.requestId },
        })
      } else if (m?.type === 'GET_STATUS') {
        queue.push({ type: 'INDEX_STATUS', payload: { documentCount: 0, ready: true } })
      }
      // Drain queue asynchronously so callers can attach listeners first.
      queueMicrotask(() => {
        const drained = queue.splice(0, queue.length)
        for (const q of drained) {
          const evt = { data: q } as MessageEvent
          for (const l of listeners) l(evt)
        }
      })
    },
    addEventListener(_type, listener) {
      listeners.add(listener)
    },
    removeEventListener(_type, listener) {
      listeners.delete(listener)
    },
  }
}

/* ----------------------------------------------------------------
 * Service implementation
 * ---------------------------------------------------------------- */

export class SearchServiceImpl {
  private deps: Required<SearchServiceDeps>
  private worker: WorkerLike | null = null
  private ready = false
  private documentCount = 0
  private inflightQueries = new Map<
    string,
    { resolve: (r: SearchResult[]) => void; reject: (e: Error) => void; query: string }
  >()
  private statusListeners = new Set<(status: SearchServiceStatus) => void>()
  private workerListener: ((e: MessageEvent) => void) | null = null
  private captureSubscription: (() => void) | null = null
  private deleteSubscription: (() => void) | null = null
  private indexReadySubscription: (() => void) | null = null
  private initialized = false

  constructor(deps: SearchServiceDeps = {}) {
    this.deps = {
      fetchDocument: deps.fetchDocument ?? ((id) => documentRepository.get(id)),
      listAll: deps.listAll ?? (() => documentRepository.listAll()),
      createWorker: deps.createWorker ?? defaultCreateWorker,
      postToWorker: deps.postToWorker ?? ((msg) => this.worker?.postMessage(msg)),
      onWorkerMessage: deps.onWorkerMessage ?? ((handler) => {
        const listener = (e: MessageEvent) => handler(e.data as WorkerOutputMessage)
        this.worker?.addEventListener('message', listener)
        this.workerListener = listener
        return () => {
          this.worker?.removeEventListener('message', listener)
          this.workerListener = null
        }
      }),
      broadcast: deps.broadcast ?? ((msg) => broadcast(msg as Parameters<typeof broadcast>[0])),
      buildSnippet: deps.buildSnippet ?? buildSnippet,
      generateRequestId: deps.generateRequestId ?? (() =>
        `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
      ),
    }
  }

  /** Wire up everything: spawn the worker, init the index, and
   *  subscribe to capture/delete events. Idempotent. */
  async start(): Promise<void> {
    if (this.initialized) return
    this.initialized = true
    this.ensureWorker()
    // Subscribe to worker events.
    this.deps.onWorkerMessage((msg) => this.handleWorkerMessage(msg))
    // Subscribe to background events. The background's main
    // SEARCH_QUERY handler is responsible for replying to the
    // caller — the service just exposes `query()` for that
    // handler to call.
    this.captureSubscription = onMessage('UPSERT_DOCUMENT', (message) => {
      const { documentId } = (message.payload || {}) as { documentId: string }
      void this.upsertDocument(documentId)
      return false
    })
    this.deleteSubscription = onMessage('REMOVE_DOCUMENT', async (message) => {
      const { documentId } = (message.payload || {}) as { documentId: string }
      this.removeDocument(documentId)
      return false
    })
    this.indexReadySubscription = onMessage('INDEX_READY', () => false)
    // Kick off the initial index build. We don't await — the
    // service can keep handling incremental updates while the
    // initial build is in flight.
    void this.initIndex()
  }

  /** Tear down subscriptions and the worker. */
  stop(): void {
    this.captureSubscription?.()
    this.deleteSubscription?.()
    this.indexReadySubscription?.()
    this.captureSubscription = null
    this.deleteSubscription = null
    this.indexReadySubscription = null
    if (this.workerListener && this.worker) {
      this.worker.removeEventListener('message', this.workerListener)
      this.workerListener = null
    }
    try {
      this.worker?.terminate?.()
    } catch {
      /* ignore */
    }
    this.worker = null
    this.ready = false
    this.documentCount = 0
    this.initialized = false
  }

  /** Rebuild the index from the database. */
  async initIndex(): Promise<void> {
    this.ensureWorker()
    // Make sure the worker listener is wired (in case `start()`
    // wasn't called).
    if (!this.workerListener) {
      this.deps.onWorkerMessage((msg) => this.handleWorkerMessage(msg))
    }
    const docs = await this.deps.listAll()
    this.deps.postToWorker({ type: 'INIT_INDEX', payload: { documents: docs } })
  }

  /** Incrementally add or update a single document. */
  async upsertDocument(id: string): Promise<void> {
    this.ensureWorker()
    if (!this.workerListener) {
      this.deps.onWorkerMessage((msg) => this.handleWorkerMessage(msg))
    }
    // We always send the documentId; the worker needs the full
    // text to (re)index. We resolve the document here on the
    // main thread (cheap DB hit) and ship the whole record.
    const doc = await this.deps.fetchDocument(id)
    if (!doc) {
      // Document was deleted between capture and index update;
      // treat as a remove.
      this.removeDocument(id)
      return
    }
    // The protocol only requires the id; we send the full
    // document as well so the worker stays stateless.
    this.deps.postToWorker({
      type: 'UPSERT_DOCUMENT',
      payload: { documentId: id, document: doc },
    })
    // Optimistically bump the count; the worker will confirm via
    // INDEX_STATUS messages.
    if (!this.ready) {
      this.documentCount += 1
    }
  }

  /** Incrementally remove a single document. */
  removeDocument(id: string): void {
    this.ensureWorker()
    if (!this.workerListener) {
      this.deps.onWorkerMessage((msg) => this.handleWorkerMessage(msg))
    }
    this.deps.postToWorker({ type: 'REMOVE_DOCUMENT', payload: { documentId: id } })
    if (this.documentCount > 0) this.documentCount -= 1
  }

  /** Run a query and await the result. */
  query(query: string, limit = 50): Promise<SearchResult[]> {
    this.ensureWorker()
    if (!this.workerListener) {
      this.deps.onWorkerMessage((msg) => this.handleWorkerMessage(msg))
    }
    if (!this.ready) {
      // Degrade gracefully: run a literal `includes()` scan
      // over the database so the user always sees *something*.
      return this.fallbackQuery(query, limit)
    }
    const trimmed = query.trim()
    if (trimmed.length === 0) return Promise.resolve([])
    const requestId = this.deps.generateRequestId()
    return new Promise<SearchResult[]>((resolve, reject) => {
      this.inflightQueries.set(requestId, { resolve, reject, query: trimmed })
      this.deps.postToWorker({
        type: 'SEARCH_QUERY',
        payload: { query: trimmed, limit, requestId },
      })
      // Safety net: never let a query hang forever.
      setTimeout(() => {
        const pending = this.inflightQueries.get(requestId)
        if (pending) {
          this.inflightQueries.delete(requestId)
          pending.reject(new Error(`search query "${trimmed}" timed out`))
        }
      }, 5000)
    }).then((results) => this.enrichSnippets(results, trimmed))
  }

  /** Return the current index status. */
  getIndexStatus(): SearchServiceStatus {
    return { ready: this.ready, documentCount: this.documentCount }
  }

  /** Subscribe to status changes. */
  onStatusChange(handler: (status: SearchServiceStatus) => void): () => void {
    this.statusListeners.add(handler)
    handler(this.getIndexStatus())
    return () => {
      this.statusListeners.delete(handler)
    }
  }

  /* ====================== internals ====================== */

  private ensureWorker(): void {
    if (this.worker) return
    this.worker = this.deps.createWorker()
  }

  private handleWorkerMessage(msg: WorkerOutputMessage): void {
    if (msg.type === 'INDEX_READY') {
      this.ready = true
      this.documentCount = msg.payload.documentCount
      this.notifyStatus()
      this.deps.broadcast({ type: 'INDEX_READY', payload: msg.payload })
      return
    }
    if (msg.type === 'INDEX_STATUS') {
      this.documentCount = msg.payload.documentCount
      this.notifyStatus()
      return
    }
    if (msg.type === 'SEARCH_RESULTS') {
      const requestId = msg.payload.requestId
      if (requestId && this.inflightQueries.has(requestId)) {
        const pending = this.inflightQueries.get(requestId)!
        this.inflightQueries.delete(requestId)
        pending.resolve(msg.payload.results)
      }
      return
    }
  }

  private notifyStatus(): void {
    const status = this.getIndexStatus()
    for (const l of this.statusListeners) {
      try {
        l(status)
      } catch {
        /* ignore */
      }
    }
  }

  /** Build a highlighted snippet for every result row. The
   *  worker ships the metadata, and we already have the full
   *  markdown in the local Dexie read we did at the start of
   *  the query — but the document cache is on the worker side.
   *  In the service we don't keep a document cache, so we hit
   *  the repository once for the matching docs and build the
   *  snippet from the cached `markdownContent`. */
  private async enrichSnippets(
    results: SearchResult[],
    query: string
  ): Promise<SearchResult[]> {
    if (results.length === 0) return results
    const enriched: SearchResult[] = []
    for (const r of results) {
      try {
        const doc = await this.deps.fetchDocument(r.documentId)
        if (!doc) {
          enriched.push(r)
          continue
        }
        const snippet = this.deps.buildSnippet(doc.markdownContent, query, {
          contextChars: 50,
        })
        enriched.push({ ...r, match: snippet || doc.title })
      } catch {
        enriched.push(r)
      }
    }
    return enriched
  }

  /** Fallback used while the index is still warming up. */
  private async fallbackQuery(query: string, limit: number): Promise<SearchResult[]> {
    const docs = await this.deps.listAll()
    const lower = query.toLowerCase().trim()
    if (!lower) return []
    const results: SearchResult[] = []
    for (const doc of docs) {
      if (results.length >= limit) break
      const hay = `${doc.title}\n${doc.markdownContent}\n${doc.description ?? ''}\n${doc.siteName ?? ''}`
      if (hay.toLowerCase().includes(lower)) {
        const snippet = this.deps.buildSnippet(doc.markdownContent, query, { contextChars: 50 })
        results.push({
          documentId: doc.id,
          document: {
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
          },
          score: 1,
          match: snippet || doc.title,
        })
      }
    }
    return results
  }
}

/* ----------------------------------------------------------------
 * Singleton accessor (background-script friendly) + DI hook
 * ---------------------------------------------------------------- */

let instance: SearchServiceImpl | null = null
let overrideDeps: SearchServiceDeps | null = null

/** Tests can inject fakes here before `getSearchService()` runs. */
export function setSearchServiceDeps(deps: SearchServiceDeps | null): void {
  overrideDeps = deps
  if (instance && deps) {
    // Rebuild the instance with the new deps.
    instance.stop()
    instance = null
  }
}

export function getSearchService(): SearchServiceImpl {
  if (!instance) {
    instance = new SearchServiceImpl(overrideDeps ?? undefined)
  }
  return instance
}

/* ----------------------------------------------------------------
 * Public, ergonomic façade
 * ---------------------------------------------------------------- */

export interface SearchFacade {
  initIndex(): Promise<void>
  upsertDocument(id: string): Promise<void>
  removeDocument(id: string): void
  query(q: string, limit?: number): Promise<SearchResult[]>
  getIndexStatus(): SearchServiceStatus
  onStatusChange(handler: (status: SearchServiceStatus) => void): () => void
}

export const searchService: SearchFacade = {
  initIndex: () => getSearchService().initIndex(),
  upsertDocument: (id) => getSearchService().upsertDocument(id),
  removeDocument: (id) => getSearchService().removeDocument(id),
  query: (q, limit) => getSearchService().query(q, limit),
  getIndexStatus: () => getSearchService().getIndexStatus(),
  onStatusChange: (handler) => getSearchService().onStatusChange(handler),
}

/* ----------------------------------------------------------------
 * Type re-exports for consumers
 * ---------------------------------------------------------------- */

export type { DocumentFetcher }
