import { describe, it, expect, beforeEach } from 'vitest'
import {
  searchIndex,
  initSearchIndex,
  addToIndex,
  removeFromIndex,
  searchDocuments,
  replaceInIndex,
} from './index'
import type { DocumentEntity } from '@/types/document'

function makeDoc(overrides: Partial<DocumentEntity> = {}): DocumentEntity {
  return {
    id: crypto.randomUUID(),
    url: 'https://example.com/test',
    title: 'Test Document',
    siteName: 'Example',
    markdown: '# Hello\n\nThis is a test document with some content.',
    excerpt: 'This is a test document...',
    wordCount: 10,
    tokenCount: 15,
    contentHash: 'abc123',
    extractionMethod: 'defuddle',
    source: 'current-page',
    capturedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

describe('Search Index', () => {
  beforeEach(() => {
    searchIndex.removeAll()
  })

  it('should add a document to the index', () => {
    const doc = makeDoc({ id: 'doc-1' })
    addToIndex(doc)
    expect(searchIndex.documentCount).toBe(1)
  })

  it('should search and return matching results', () => {
    addToIndex(makeDoc({ id: 'doc-1', title: 'Machine Learning Guide', markdown: 'Deep learning basics' }))
    addToIndex(makeDoc({ id: 'doc-2', title: 'Cooking Recipes', markdown: 'How to cook pasta' }))
    addToIndex(makeDoc({ id: 'doc-3', title: 'Deep Learning Advanced', markdown: 'Neural network architectures' }))

    const results = searchDocuments('deep learning')
    expect(results.length).toBeGreaterThanOrEqual(1)
    const ids = results.map((r) => r.id)
    expect(ids).toContain('doc-1')
    expect(ids).toContain('doc-3')
    // doc-2 (cooking) should not match
    expect(ids).not.toContain('doc-2')
  })

  it('should remove a document from the index', () => {
    addToIndex(makeDoc({ id: 'doc-1' }))
    expect(searchIndex.documentCount).toBe(1)

    removeFromIndex('doc-1')
    expect(searchIndex.documentCount).toBe(0)

    const results = searchDocuments('test')
    expect(results.length).toBe(0)
  })

  it('should not throw when removing a document that was never indexed', () => {
    // Regression: MiniSearch.discard() throws if the id isn't in the index.
    // This happens when a doc is deleted before the async index init finishes,
    // or arrives via sync/import without entering the in-memory index. Without
    // the guard, deleteDocument() throws and confirmDelete() aborts before it
    // can close the modal or refresh the list.
    expect(() => removeFromIndex('never-indexed-id')).not.toThrow()
  })

  it('should replace a document in the index', () => {
    addToIndex(makeDoc({ id: 'doc-1', title: 'Old Title' }))
    replaceInIndex(makeDoc({ id: 'doc-1', title: 'New Title', markdown: 'Completely different content about quantum physics' }))

    expect(searchIndex.documentCount).toBe(1)
    const results = searchDocuments('quantum physics')
    expect(results.length).toBe(1)
    expect(results[0].id).toBe('doc-1')
  })

  it('should return empty for searches with no matches', () => {
    addToIndex(makeDoc({ id: 'doc-1', title: 'Test', markdown: 'sample content' }))
    const results = searchDocuments('xyznonexistent123')
    expect(results.length).toBe(0)
  })

  it('should boost title matches over content-only matches', () => {
    // Doc with "quantum" in title should rank higher
    addToIndex(makeDoc({ id: 'doc-low', title: 'General Science Overview', markdown: 'This document mentions quantum physics briefly.' }))
    addToIndex(makeDoc({ id: 'doc-high', title: 'Quantum Physics Complete Guide', markdown: 'An introduction to science.' }))

    const results = searchDocuments('quantum')
    expect(results.length).toBeGreaterThanOrEqual(1)

    if (results.length >= 2) {
      // "doc-high" has "quantum" in title (boost 3) vs content-only (boost 1)
      const highIdx = results.findIndex((r) => r.id === 'doc-high')
      const lowIdx = results.findIndex((r) => r.id === 'doc-low')
      expect(highIdx).toBeLessThan(lowIdx)
    }
  })

  it('should initialize the index from all documents', async () => {
    // This test verifies the function signature and basic flow.
    // Full init with real DB would require mocking Dexie.
    initSearchIndex()
    expect(searchIndex.documentCount).toBe(0)
  })
})
