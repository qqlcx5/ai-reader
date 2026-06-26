/**
 * Integration test for the search worker.
 *
 * The worker file is a self-contained module that wires its
 * own `onmessage` handler against the global `self`. To test
 * it without a real `Worker`, we install a fake `self` with a
 * `postMessage` spy and an in-test event dispatcher, import
 * the worker source once, and then drive it by calling the
 * captured `onmessage` with a `MessageEvent`-shaped object.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { CapturedDocument, SearchResult } from '@db/schema'
import type { WorkerInputMessage, WorkerOutputMessage } from './search.worker'

/* ----------------------------------------------------------------
 * Fake worker globals
 * ---------------------------------------------------------------- */

interface FakeSelf {
  postMessage: ReturnType<typeof vi.fn>
  addEventListener: (type: string, listener: (e: MessageEvent) => void) => void
  removeEventListener: (type: string, listener: (e: MessageEvent) => void) => void
  __listeners: Set<(e: MessageEvent) => void>
  __dispatch: (msg: WorkerInputMessage) => void
}

let fakeSelf: FakeSelf
let sent: WorkerOutputMessage[]

function installFakeSelf() {
  sent = []
  const listeners = new Set<(e: MessageEvent) => void>()
  fakeSelf = {
    __listeners: listeners,
    postMessage: vi.fn((msg: unknown) => {
      sent.push(msg as WorkerOutputMessage)
    }),
    addEventListener: (_type: string, listener: (e: MessageEvent) => void) => {
      listeners.add(listener)
    },
    removeEventListener: (_type: string, listener: (e: MessageEvent) => void) => {
      listeners.delete(listener)
    },
    __dispatch(msg: WorkerInputMessage) {
      const evt = { data: msg } as MessageEvent
      for (const l of listeners) l(evt)
    },
  }
  ;(globalThis as unknown as { self: FakeSelf }).self = fakeSelf
  ;(globalThis as unknown as { Worker: unknown }).Worker = function () {
    /* fake */
  }
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

describe('search.worker', () => {
  beforeEach(() => {
    installFakeSelf()
    // Re-import the module for each test so the internal index
    // starts empty. Vitest caches modules; using a unique
    // query string bypasses the cache.
    vi.resetModules()
  })

  async function loadWorker() {
    await import('./search.worker')
    // Give the module time to attach the listener.
    return new Promise<void>((resolve) => setTimeout(resolve, 0))
  }

  it('replies with INDEX_READY after a full INIT_INDEX', async () => {
    await loadWorker()
    fakeSelf.__dispatch({
      type: 'INIT_INDEX',
      payload: {
        documents: [makeDoc({ id: 'a' }), makeDoc({ id: 'b' }), makeDoc({ id: 'c' })],
      },
    })
    await new Promise((r) => setTimeout(r, 0))
    const ready = sent.find((m) => m.type === 'INDEX_READY')
    expect(ready).toBeDefined()
    if (ready?.type !== 'INDEX_READY') throw new Error('expected INDEX_READY')
    expect(ready.payload.documentCount).toBe(3)
  })

  it('searches across the indexed documents and ranks title hits higher', async () => {
    await loadWorker()
    fakeSelf.__dispatch({
      type: 'INIT_INDEX',
      payload: {
        documents: [
          makeDoc({
            id: 'low',
            title: 'A story about persistence',
            markdownContent: 'Type theory is interesting.',
          }),
          makeDoc({
            id: 'high',
            title: 'Type theory intro',
            markdownContent: 'A friendly introduction.',
          }),
        ],
      },
    })
    await new Promise((r) => setTimeout(r, 0))
    sent.length = 0 // discard INDEX_READY

    fakeSelf.__dispatch({
      type: 'SEARCH_QUERY',
      payload: { query: 'type', limit: 10, requestId: 'r1' },
    })
    await new Promise((r) => setTimeout(r, 0))

    const reply = sent.find((m) => m.type === 'SEARCH_RESULTS')
    expect(reply).toBeDefined()
    if (reply?.type !== 'SEARCH_RESULTS') throw new Error('expected SEARCH_RESULTS')
    expect(reply.payload.query).toBe('type')
    expect(reply.payload.results).toHaveLength(2)
    // The title hit should come first because the title field
    // has weight 3.
    expect(reply.payload.results[0]?.documentId).toBe('high')
    expect(reply.payload.requestId).toBe('r1')
  })

  it('handles an empty query without throwing', async () => {
    await loadWorker()
    fakeSelf.__dispatch({
      type: 'INIT_INDEX',
      payload: { documents: [makeDoc({ id: 'a' })] },
    })
    await new Promise((r) => setTimeout(r, 0))
    sent.length = 0
    fakeSelf.__dispatch({
      type: 'SEARCH_QUERY',
      payload: { query: '   ', limit: 10, requestId: 'r2' },
    })
    await new Promise((r) => setTimeout(r, 0))
    const reply = sent.find((m) => m.type === 'SEARCH_RESULTS')
    if (reply?.type !== 'SEARCH_RESULTS') throw new Error('expected SEARCH_RESULTS')
    expect(reply.payload.results).toEqual([])
  })

  it('incrementally adds a single document via UPSERT_DOCUMENT', async () => {
    await loadWorker()
    fakeSelf.__dispatch({
      type: 'INIT_INDEX',
      payload: { documents: [makeDoc({ id: 'a', title: 'A' })] },
    })
    await new Promise((r) => setTimeout(r, 0))
    sent.length = 0

    fakeSelf.__dispatch({
      type: 'UPSERT_DOCUMENT',
      payload: { documentId: 'b', document: makeDoc({ id: 'b', title: 'B' }) },
    })
    fakeSelf.__dispatch({
      type: 'SEARCH_QUERY',
      payload: { query: 'B', limit: 10, requestId: 'r3' },
    })
    await new Promise((r) => setTimeout(r, 0))

    const reply = sent.find((m) => m.type === 'SEARCH_RESULTS')
    if (reply?.type !== 'SEARCH_RESULTS') throw new Error('expected SEARCH_RESULTS')
    const ids = (reply.payload.results as SearchResult[]).map((r) => r.documentId)
    expect(ids).toContain('b')
  })

  it('replaces an existing document on UPSERT', async () => {
    await loadWorker()
    fakeSelf.__dispatch({
      type: 'INIT_INDEX',
      payload: { documents: [makeDoc({ id: 'a', title: 'Old title' })] },
    })
    await new Promise((r) => setTimeout(r, 0))

    fakeSelf.__dispatch({
      type: 'UPSERT_DOCUMENT',
      payload: { documentId: 'a', document: makeDoc({ id: 'a', title: 'New title' }) },
    })
    sent.length = 0
    fakeSelf.__dispatch({
      type: 'SEARCH_QUERY',
      payload: { query: 'New', limit: 10, requestId: 'r4' },
    })
    await new Promise((r) => setTimeout(r, 0))

    const reply = sent.find((m) => m.type === 'SEARCH_RESULTS')
    if (reply?.type !== 'SEARCH_RESULTS') throw new Error('expected SEARCH_RESULTS')
    expect((reply.payload.results[0]?.document as { title: string }).title).toBe('New title')
  })

  it('removes a document via REMOVE_DOCUMENT', async () => {
    await loadWorker()
    fakeSelf.__dispatch({
      type: 'INIT_INDEX',
      payload: { documents: [makeDoc({ id: 'a', title: 'Keep' })] },
    })
    await new Promise((r) => setTimeout(r, 0))
    sent.length = 0

    fakeSelf.__dispatch({ type: 'REMOVE_DOCUMENT', payload: { documentId: 'a' } })
    fakeSelf.__dispatch({
      type: 'SEARCH_QUERY',
      payload: { query: 'Keep', limit: 10, requestId: 'r5' },
    })
    await new Promise((r) => setTimeout(r, 0))
    const reply = sent.find((m) => m.type === 'SEARCH_RESULTS')
    if (reply?.type !== 'SEARCH_RESULTS') throw new Error('expected SEARCH_RESULTS')
    expect(reply.payload.results).toEqual([])
  })

  it('responds to GET_STATUS with the current document count', async () => {
    await loadWorker()
    fakeSelf.__dispatch({
      type: 'INIT_INDEX',
      payload: {
        documents: [makeDoc({ id: 'a' }), makeDoc({ id: 'b' })],
      },
    })
    await new Promise((r) => setTimeout(r, 0))
    sent.length = 0

    fakeSelf.__dispatch({ type: 'GET_STATUS', payload: {} })
    await new Promise((r) => setTimeout(r, 0))
    const status = sent.find((m) => m.type === 'INDEX_STATUS')
    if (status?.type !== 'INDEX_STATUS') throw new Error('expected INDEX_STATUS')
    expect(status.payload.documentCount).toBe(2)
  })
})
