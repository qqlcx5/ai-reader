import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAppStore } from './app.store'

describe('stores/app.store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('should initialize with default values', () => {
    const store = useAppStore()
    expect(store.currentView).toBe('workspace')
    expect(store.isLoading).toBe(false)
    expect(store.activeTab).toBeNull()
    expect(store.showPageChangeHint).toBe(false)
  })

  it('should change currentView via setCurrentView', () => {
    const store = useAppStore()
    store.setCurrentView('library')
    expect(store.currentView).toBe('library')
    store.setCurrentView('settings')
    expect(store.currentView).toBe('settings')
    store.setCurrentView('workspace')
    expect(store.currentView).toBe('workspace')
  })

  it('should show and clear toast', () => {
    const store = useAppStore()
    store.showToast('test message', 'error')
    expect(store.toastMessage).toBe('test message')
    expect(store.toastType).toBe('error')
    store.clearToast()
    expect(store.toastMessage).toBe('')
  })

  it('should default toast type to info', () => {
    const store = useAppStore()
    store.showToast('info message')
    expect(store.toastType).toBe('info')
  })

  it('should set activeTab', () => {
    const store = useAppStore()
    const tab = { id: 1, url: 'https://example.com', title: 'Example' }
    store.setActiveTab(tab)
    expect(store.activeTab).toEqual(tab)
  })

  it('should toggle showPageChangeHint', () => {
    const store = useAppStore()
    expect(store.showPageChangeHint).toBe(false)
    store.showPageChangeHint = true
    expect(store.showPageChangeHint).toBe(true)
  })

  it('should set loading state', () => {
    const store = useAppStore()
    store.setLoading(true)
    expect(store.isLoading).toBe(true)
    store.setLoading(false)
    expect(store.isLoading).toBe(false)
  })
})
