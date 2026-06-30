import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useWorkspaceStore } from './workspace.store'

describe('stores/workspace.store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('should initialize with default values', () => {
    const store = useWorkspaceStore()
    expect(store.currentWorkspaceTab).toBe('capture')
    expect(store.currentContextTab).toBe('markdown')
    expect(store.documentSource).toBe('current-page')
    expect(store.isExtracting).toBe(false)
  })

  it('should change workspace tab', () => {
    const store = useWorkspaceStore()
    store.setWorkspaceTab('preview')
    expect(store.currentWorkspaceTab).toBe('preview')
  })

  it('should change context tab', () => {
    const store = useWorkspaceStore()
    store.setContextTab('metadata')
    expect(store.currentContextTab).toBe('metadata')
  })

  it('should set extracting state', () => {
    const store = useWorkspaceStore()
    store.setExtracting(true)
    expect(store.isExtracting).toBe(true)
    store.setExtracting(false)
    expect(store.isExtracting).toBe(false)
  })

  it('should change documentSource', () => {
    const store = useWorkspaceStore()
    expect(store.documentSource).toBe('current-page')
    store.setDocumentSource('library')
    expect(store.documentSource).toBe('library')
    store.setDocumentSource('current-page')
    expect(store.documentSource).toBe('current-page')
  })

  it('should toggle showPageChangeHint', () => {
    const store = useWorkspaceStore()
    expect(store.showPageChangeHint).toBe(false)
    store.showPageChangeHint = true
    expect(store.showPageChangeHint).toBe(true)
  })
})
