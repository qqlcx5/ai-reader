/**
 * Tests for the search service.
 *
 * The service owns a `WorkerLike` whose real implementation
 * lives in `workers/search.worker.ts`. The worker itself is
 * covered by a separate integration-style test (also in this
 * directory) that imports the worker source and drives it via
 * a fake `MessageEvent`. Here we focus on the orchestration:
 *   - `initIndex` pulls every document from the repository
 *   - `upsertDocument` forwards the full document
 *   - `query` resolves with sorted results
 *   - `query` falls back to a `LIKE` scan while the index is
 *     still warming up
 *   - the service broadcasts `INDEX_READY` to other contexts
 */

import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { db } from '@db/dexie'
import { documentRepository } from '@core/documents/document.repository'
import {
  SearchServiceImpl,
  setSearchServiceDeps,
  getSearchService,
} from './search.service'
import type { CapturedDocument, SearchResult } from '@db/schema'
import type {
  WorkerInputMessage,
  WorkerOutputMessage,
} from '../../workers/search.worker'

/* ----------------------------------------------------------------
 * In-memory MiniSearch-style worker mock
 * ---------------------------------------------------------------- */

function makeFakeWorker() {
  const listeners = new Set<(e: MessageEvent) => void>()
  const sent: WorkerInputMessage[] = []
  let index: {
    docs: Map<string, CapturedDocument>
  } = { docs: new Map() }

  const worker = {
    postMessage(msg: unknown) {
      sent.push(msg as WorkerInputMessage)
      const m = msg as WorkerInputMessage
      if (m.type === 'INIT_INDEX') {
        const { documents } = m.payload
        index.docs = new Map(documents.map((d) => [d.id, d]))
        emit({ type: 'INDEX_READY', payload: { documentCount: index.docs.size } })
      } else if (m.type === 'UPSERT_DOCUMENT') {
        const { documentId, document } = m.payload
        if (document) {
          index.docs.set(documentId, document)
        }
      } else if (m.type === 'REMOVE_DOCUMENT') {
        const { documentId } = m.payload
        index.docs.delete(documentId)
      } else if (m.type === 'SEARCH_QUERY') {
        const { query, limit = 50, requestId } = m.payload
        const lower = query.toLowerCase()
        const hits: SearchResult[] = []
        for (const doc of index.docs.values()) {
          if (
            doc.title.toLowerCase().includes(lower) ||
            doc.markdownContent.toLowerCase().includes(lower)
          ) {
            hits.push({
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
              score: hits.length + 1,
              match: doc.title,
            })
            if (hits.length >= limit) break
          }
        }
        emit({ type: 'SEARCH_RESULTS', payload: { query, results: hits, requestId } })
      } else if (m.type === 'GET_STATUS') {
        emit({ type: 'INDEX_STATUS', payload: { documentCount: index.docs.size, ready: true } })
      }
    },
    addEventListener(_type: 'message', listener: (e: MessageEvent) => void) {
      listeners.add(listener)
    },
    removeEventListener(_type: 'message', listener: (e: MessageEvent) => void) {
      listeners.delete(listener)
    },
    terminate() {
      listeners.clear()
    },
  }
  function emit(msg: WorkerOutputMessage) {
    queueMicrotask(() => {
      const evt = { data: msg } as MessageEvent
      for (const l of listeners) l(evt)
    })
  }
  return { worker, sent, getIndex: () => index }
}

/* ----------------------------------------------------------------
 * Fixtures
 * ---------------------------------------------------------------- */

function makeDoc(overrides: Partial<CapturedDocument> = {}): CapturedDocument {
  return {
    id: overrides.id ?? 'doc-1',
    url: overrides.url ?? 'https://example.com/a',
    title: overrides.title ?? 'Hello world',
    markdownContent: overrides.markdownContent ?? 'The quick brown fox.',
    createdAt: overrides.createdAt ?? 1_700_000_000_000,
    updatedAt: overrides.updatedAt ?? 1_700_000_000_000,
    ...overrides,
  }
}

/* ----------------------------------------------------------------
 * Tests
 * ---------------------------------------------------------------- */

describe('SearchServiceImpl', () => {
  beforeEach(async () => {
    await db.delete()
    await db.open()
    setSearchServiceDeps(null)
  })

  it('initIndex loads every document from the repository into the worker', async () => {
    await documentRepository.put(makeDoc({ id: 'a' }))
    await documentRepository.put(makeDoc({ id: 'b' }))
    await documentRepository.put(makeDoc({ id: 'c' }))

    const fake = makeFakeWorker()
    const service = new SearchServiceImpl({
      createWorker: () => fake.worker,
      broadcast: () => undefined,
    })
    await service.initIndex()

    // Allow the microtask to run.
    await new Promise((r) => setTimeout(r, 0))

    expect(fake.sent[0]?.type).toBe('INIT_INDEX')
    const initMsg = fake.sent[0]
    if (initMsg?.type !== 'INIT_INDEX') throw new Error('expected INIT_INDEX')
    expect(initMsg.payload.documents).toHaveLength(3)
    expect(service.getIndexStatus()).toEqual({ ready: true, documentCount: 3 })
  })

  it('upsertDocument forwards the full document to the worker', async () => {
    const fake = makeFakeWorker()
    const service = new SearchServiceImpl({
      createWorker: () => fake.worker,
      fetchDocument: async (id) => makeDoc({ id, title: 'fetched-' + id }),
    })
    await service.upsertDocument('xyz')
    await new Promise((r) => setTimeout(r, 0))

    const upsert = fake.sent.find((m) => m.type === 'UPSERT_DOCUMENT')
    expect(upsert).toBeDefined()
    if (upsert?.type !== 'UPSERT_DOCUMENT') throw new Error('expected UPSERT_DOCUMENT')
    expect(upsert.payload.documentId).toBe('xyz')
    expect(upsert.payload.document?.title).toBe('fetched-xyz')
  })

  it('upsertDocument treats a missing document as a remove', async () => {
    const fake = makeFakeWorker()
    const service = new SearchServiceImpl({
      createWorker: () => fake.worker,
      fetchDocument: async () => undefined,
    })
    await service.upsertDocument('ghost')
    await new Promise((r) => setTimeout(r, 0))

    const remove = fake.sent.find((m) => m.type === 'REMOVE_DOCUMENT')
    expect(remove).toBeDefined()
    if (remove?.type !== 'REMOVE_DOCUMENT') throw new Error('expected REMOVE_DOCUMENT')
    expect(remove.payload.documentId).toBe('ghost')
  })

  it('query returns the worker’s sorted results', async () => {
    const fake = makeFakeWorker()
    const service = new SearchServiceImpl({
      createWorker: () => fake.worker,
      // Seed the fake's index via listAll so the service's
      // initIndex() round-trips through the worker (which also
      // wires the listener).
      listAll: async () => [
        makeDoc({ id: 'x', title: 'Vue Router', markdownContent: 'Routing in Vue.' }),
        makeDoc({ id: 'y', title: 'React Router', markdownContent: 'Routing in React.' }),
      ],
    })
    await service.initIndex()
    // Wait for the microtask that delivers INDEX_READY.
    await new Promise((r) => setTimeout(r, 0))

    const results = await service.query('router')
    expect(results.length).toBe(2)
    expect(results.map((r) => r.documentId).sort()).toEqual(['x', 'y'])
  })

  it('query falls back to a LIKE scan when the index is not yet ready', async () => {
    await documentRepository.put(
      makeDoc({ id: 'a', title: 'A note about typescript', markdownContent: 'TS is great.' }),
    )
    await documentRepository.put(
      makeDoc({ id: 'b', title: 'A note about rust', markdownContent: 'Rust is great.' }),
    )

    const fake = makeFakeWorker() // never posts INIT_INDEX
    const service = new SearchServiceImpl({
      createWorker: () => fake.worker,
    })
    // Don't call start(); query should still work via fallback.
    const results = await service.query('typescript')
    expect(results.length).toBe(1)
    expect(results[0]?.documentId).toBe('a')
  })

  it('query resolves to [] for an empty query', async () => {
    const fake = makeFakeWorker()
    const service = new SearchServiceImpl({ createWorker: () => fake.worker })
    await expect(service.query('   ')).resolves.toEqual([])
  })

  it('removeDocument sends REMOVE_DOCUMENT to the worker', async () => {
    const fake = makeFakeWorker()
    const service = new SearchServiceImpl({ createWorker: () => fake.worker })
    service.removeDocument('doomed')
    await new Promise((r) => setTimeout(r, 0))
    const remove = fake.sent.find((m) => m.type === 'REMOVE_DOCUMENT')
    expect(remove).toBeDefined()
    if (remove?.type !== 'REMOVE_DOCUMENT') throw new Error('expected REMOVE_DOCUMENT')
    expect(remove.payload.documentId).toBe('doomed')
  })

  it('broadcasts INDEX_READY to other extension contexts', async () => {
    const fake = makeFakeWorker()
    const broadcast = vi.fn()
    const service = new SearchServiceImpl({
      createWorker: () => fake.worker,
      broadcast,
    })
    await service.initIndex()
    await new Promise((r) => setTimeout(r, 0))
    expect(broadcast).toHaveBeenCalledWith({
      type: 'INDEX_READY',
      payload: { documentCount: 0 },
    })
  })

  it('notifies status subscribers when the index becomes ready', async () => {
    const fake = makeFakeWorker()
    const service = new SearchServiceImpl({
      createWorker: () => fake.worker,
      broadcast: () => undefined,
    })
    const handler = vi.fn()
    service.onStatusChange(handler)
    handler.mockClear() // ignore initial invocation
    await service.initIndex()
    await new Promise((r) => setTimeout(r, 0))
    expect(handler).toHaveBeenCalledWith({ ready: true, documentCount: 0 })
  })
})

describe('getSearchService', () => {
  it('returns a singleton instance', () => {
    const a = getSearchService()
    const b = getSearchService()
    expect(a).toBe(b)
  })

  it('rebuilds the instance when setSearchServiceDeps is called', () => {
    const a = getSearchService()
    setSearchServiceDeps({ broadcast: () => undefined })
    const b = getSearchService()
    expect(a).not.toBe(b)
    // Reset for the next test.
    setSearchServiceDeps(null)
  })
})
