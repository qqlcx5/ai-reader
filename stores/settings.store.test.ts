import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useSettingsStore } from './settings.store'

describe('stores/settings.store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('should initialize with default settings', () => {
    const store = useSettingsStore()
    expect(store.settings.id).toBe('app-settings')
    expect(store.settings.context.maxContextTokens).toBe(1050000)
    expect(store.settings.capture.autoExtractOnOpen).toBe(true)
    expect(store.isLoaded).toBe(false)
  })

  it('should update global system prompt', () => {
    const store = useSettingsStore()
    store.updateGlobalSystemPrompt('You are helpful')
    expect(store.settings.globalSystemPrompt).toBe('You are helpful')
  })

  it('should update context settings partially', () => {
    const store = useSettingsStore()
    store.updateContextSettings({ maxContextTokens: 16000 })
    expect(store.settings.context.maxContextTokens).toBe(16000)
    // other fields should remain
    expect(store.settings.context.includeMetadataInPrompt).toBe(true)
  })

  it('should update capture settings partially', () => {
    const store = useSettingsStore()
    store.updateCaptureSettings({ autoExtractOnOpen: false, saveRawHtml: true })
    expect(store.settings.capture.autoExtractOnOpen).toBe(false)
    expect(store.settings.capture.saveRawHtml).toBe(true)
    // other fields should remain
    expect(store.settings.capture.autoExtractOnTabChange).toBe(false)
  })
})
