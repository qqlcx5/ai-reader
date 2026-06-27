import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useModelStore } from './model.store'

describe('stores/model.store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('should initialize with empty models', () => {
    const store = useModelStore()
    expect(store.models).toEqual([])
    expect(store.currentModelId).toBeNull()
    expect(store.currentModel).toBeNull()
    expect(store.defaultModel).toBeNull()
  })

  it('should select a model by id', () => {
    const store = useModelStore()
    store.selectModel('model-1')
    expect(store.currentModelId).toBe('model-1')
  })

  it('should compute current model correctly when models are loaded', () => {
    const store = useModelStore()
    const model = {
      id: 'm1',
      name: 'GPT-4',
      provider: 'openai-compatible' as const,
      modelId: 'gpt-4',
      enabled: true,
      isDefault: true,
      contextWindow: 128000,
      temperature: 0.7,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    // Manually set state for test
    store.$patch({ models: [model], currentModelId: 'm1' })
    expect(store.currentModel?.name).toBe('GPT-4')
    expect(store.defaultModel?.name).toBe('GPT-4')
  })
})
