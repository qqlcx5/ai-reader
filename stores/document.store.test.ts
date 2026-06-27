import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useDocumentStore } from './document.store'

describe('stores/document.store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('should initialize with null documents', () => {
    const store = useDocumentStore()
    expect(store.currentDocument).toBeNull()
    expect(store.pageDocument).toBeNull()
    expect(store.documents).toEqual([])
  })

  it('should set current document directly', () => {
    const store = useDocumentStore()
    const doc = {
      id: '1',
      url: 'https://example.com',
      title: 'Test',
      markdown: '',
      wordCount: 0,
      tokenCount: 0,
      contentHash: 'abc',
      extractionMethod: 'manual' as const,
      source: 'library' as const,
      capturedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    store.setCurrentDocument(doc)
    expect(store.currentDocument?.id).toBe('1')
  })

  it('should set page document directly', () => {
    const store = useDocumentStore()
    const doc = {
      id: '2',
      url: 'https://example.com/page',
      title: 'Page',
      markdown: 'test',
      wordCount: 1,
      tokenCount: 1,
      contentHash: 'def',
      extractionMethod: 'defuddle' as const,
      source: 'current-page' as const,
      capturedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    store.setPageDocument(doc)
    expect(store.pageDocument?.id).toBe('2')
  })
})
