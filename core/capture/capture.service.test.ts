/**
 * capture.service unit tests.
 *
 * Wires the full flow together using mocks for sendToTab, the
 * document repository, and chrome.sidePanel.open. IndexedDB is
 * backed by `fake-indexeddb` so the repository calls actually
 * persist.
 */

import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { db } from '@db/dexie'

// Shared state for the defuddle mock.
const defuddleMocks = vi.hoisted(() => {
  const parseMock = vi.fn()
  const parseAsyncMock = vi.fn()
  const createMarkdownContentMock = vi.fn((html: string) => `MD(${html.length})`)
  // Class form so vitest can construct it via `new`.
  class Defuddle {
    parse(...args: unknown[]): unknown {
      return parseMock(...args)
    }
    parseAsync(...args: unknown[]): Promise<unknown> {
      return parseAsyncMock(...args) as Promise<unknown>
    }
  }
  return { parseMock, parseAsyncMock, createMarkdownContentMock, Defuddle }
})

vi.mock('defuddle/full', () => ({
  get default() {
    return defuddleMocks.Defuddle
  },
  get createMarkdownContent() {
    return defuddleMocks.createMarkdownContentMock
  },
  __mocks: defuddleMocks,
}))

// Mocks for chrome APIs not covered by the global stub in
// tests/setup.ts.
;(globalThis as unknown as { chrome: typeof chrome }).chrome = {
  ...(globalThis as unknown as { chrome: typeof chrome }).chrome,
  sidePanel: {
    open: vi.fn(async () => undefined),
    setOptions: vi.fn(async () => undefined),
  },
} as unknown as typeof chrome

import { captureCurrentTab, captureFromDocument } from './capture.service'
import type { CapturedDocument } from '@db/schema'

function makeDoc(overrides: Partial<CapturedDocument> = {}): CapturedDocument {
  return {
    id: overrides.id ?? 'doc-1',
    url: overrides.url ?? 'https://example.com/post',
    title: overrides.title ?? 'Example post',
    markdownContent: overrides.markdownContent ?? '# Hello',
    createdAt: overrides.createdAt ?? Date.now(),
    updatedAt: overrides.updatedAt ?? Date.now(),
    ...overrides,
  }
}

beforeEach(async () => {
  await db.delete()
  await db.open()
  vi.clearAllMocks()
  defuddleMocks.parseMock.mockReset()
  defuddleMocks.parseAsyncMock.mockReset()
})

describe('captureCurrentTab', () => {
  it('runs the full flow and returns a documentId', async () => {
    const sendToTab = vi.fn().mockResolvedValue({
      success: true,
      data: { document: makeDoc({ id: 'incoming' }), source: 'defuddle' as const },
    })
    const putDocument = vi.fn(async (doc: CapturedDocument) => doc.id)
    const notifyIndex = vi.fn()
    const openSidePanel = vi.fn(async () => undefined)

    const result = await captureCurrentTab(42, {
      sendToTab,
      putDocument,
      notifyIndex,
      openSidePanel,
    })

    expect(sendToTab).toHaveBeenCalledWith(
      42,
      expect.objectContaining({ type: 'CAPTURE_PAGE', payload: {} })
    )
    expect(putDocument).toHaveBeenCalledTimes(1)
    expect(notifyIndex).toHaveBeenCalledWith('incoming')
    expect(openSidePanel).toHaveBeenCalledWith(42)
    expect(result.documentId).toBe('incoming')
    expect(result.document.id).toBe('incoming')
  })

  it('persists the document to IndexedDB via default deps', async () => {
    const sendToTab = vi.fn().mockResolvedValue({
      success: true,
      data: { document: makeDoc({ id: 'persisted' }), source: 'defuddle' as const },
    })
    const notifyIndex = vi.fn()
    const openSidePanel = vi.fn(async () => undefined)

    const result = await captureCurrentTab(7, {
      sendToTab,
      notifyIndex,
      openSidePanel,
    })

    expect(result.documentId).toBe('persisted')
    const stored = await db.documents.get('persisted')
    expect(stored).toBeDefined()
    expect(stored?.title).toBe('Example post')
  })

  it('throws CaptureError when content script returns failure', async () => {
    const sendToTab = vi.fn().mockResolvedValue({
      success: false,
      error: 'no document',
    })
    await expect(
      captureCurrentTab(1, { sendToTab })
    ).rejects.toThrow(/no document|Failed to persist|reached content script/)
  })

  it('throws when sendToTab itself rejects (no content script)', async () => {
    const sendToTab = vi.fn().mockRejectedValue(new Error('no receiver'))
    await expect(
      captureCurrentTab(99, { sendToTab })
    ).rejects.toThrow(/Failed to reach content script/)
  })

  it('throws when repository.put fails', async () => {
    const sendToTab = vi.fn().mockResolvedValue({
      success: true,
      data: { document: makeDoc({ id: 'x' }), source: 'defuddle' as const },
    })
    const putDocument = vi.fn().mockRejectedValue(new Error('quota exceeded'))
    await expect(
      captureCurrentTab(1, { sendToTab, putDocument })
    ).rejects.toThrow(/Failed to persist captured document/)
  })

  it('still returns success when side panel fails to open', async () => {
    const sendToTab = vi.fn().mockResolvedValue({
      success: true,
      data: { document: makeDoc({ id: 'ok' }), source: 'defuddle' as const },
    })
    const putDocument = vi.fn(async (doc: CapturedDocument) => doc.id)
    const openSidePanel = vi.fn().mockRejectedValue(new Error('boom'))
    const result = await captureCurrentTab(3, {
      sendToTab,
      putDocument,
      openSidePanel,
    })
    expect(result.documentId).toBe('ok')
  })

  it('rejects an invalid tabId', async () => {
    await expect(captureCurrentTab(-1 as never)).rejects.toThrow(/Invalid tabId/)
  })

  it('notifies the search worker via the injected notifier', async () => {
    const sendToTab = vi.fn().mockResolvedValue({
      success: true,
      data: { document: makeDoc({ id: 'idx' }), source: 'defuddle' as const },
    })
    const notifyIndex = vi.fn()
    const openSidePanel = vi.fn(async () => undefined)
    await captureCurrentTab(1, { sendToTab, notifyIndex, openSidePanel })
    expect(notifyIndex).toHaveBeenCalledWith('idx')
  })
})

describe('captureFromDocument', () => {
  it('extracts from a Document directly and persists (fallback path)', async () => {
    const parser = new DOMParser()
    const doc = parser.parseFromString(
      '<html><head><title>Direct</title></head><body><p>Body text</p></body></html>',
      'text/html'
    )
    Object.defineProperty(doc, 'URL', { value: 'https://x.test/y', configurable: true })
    Object.defineProperty(doc, 'documentURI', { value: 'https://x.test/y', configurable: true })
    Object.defineProperty(doc, 'baseURI', { value: 'https://x.test/y', configurable: true })

    // Force the fallback path by making defuddle throw.
    defuddleMocks.parseMock.mockImplementation(() => {
      throw new Error('forced fallback')
    })

    const notifyIndex = vi.fn()
    const result = await captureFromDocument(doc, 'https://x.test/y', { notifyIndex })
    expect(result.documentId).toBeTruthy()
    expect(notifyIndex).toHaveBeenCalledWith(result.documentId)
    const stored = await db.documents.get(result.documentId)
    expect(stored).toBeDefined()
    expect(stored?.markdownContent).toContain('Body text')
  })

  it('uses defuddle output when it succeeds', async () => {
    const parser = new DOMParser()
    const doc = parser.parseFromString(
      '<html><head><title>Direct</title></head><body><p>Body</p></body></html>',
      'text/html'
    )
    Object.defineProperty(doc, 'URL', { value: 'https://x.test/y', configurable: true })
    Object.defineProperty(doc, 'documentURI', { value: 'https://x.test/y', configurable: true })
    Object.defineProperty(doc, 'baseURI', { value: 'https://x.test/y', configurable: true })

    defuddleMocks.parseMock.mockReturnValue({
      title: 'Direct',
      content: '<p>Body</p>',
      contentMarkdown: '# Direct\n\nBody',
      wordCount: 2,
    })

    const result = await captureFromDocument(doc, 'https://x.test/y')
    expect(result.document.markdownContent).toBe('# Direct\n\nBody')
    expect(result.document.title).toBe('Direct')
  })
})
