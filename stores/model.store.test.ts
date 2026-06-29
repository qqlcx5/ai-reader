import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import type { ModelConfig } from '../types/model'

vi.mock('../db/repositories/model.repository', () => {
  const store = new Map<string, ModelConfig>()
  return {
    ModelRepository: {
      findAll: vi.fn(async () => Array.from(store.values())),
      findById: vi.fn(async (id: string) => store.get(id)),
      findDefault: vi.fn(async () => {
        for (const m of store.values()) {
          if (m.isDefault) return m
        }
        return undefined
      }),
      save: vi.fn(async (model: ModelConfig) => {
        store.set(model.id, { ...model })
        return { ...model }
      }),
      delete: vi.fn(async (id: string) => {
        store.delete(id)
      }),
    },
  }
})

vi.mock('../services/ai/test-connection.service', () => ({
  testConnection: vi.fn(),
}))

import { useModelStore } from './model.store'
import { ModelRepository } from '../db/repositories/model.repository'
import { testConnection as mockTestConnection } from '../services/ai/test-connection.service'

function makeModel(overrides: Partial<ModelConfig> = {}): ModelConfig {
  return {
    id: 'm1',
    name: 'GPT-4',
    provider: 'openai-compatible',
    modelId: 'gpt-4',
    enabled: true,
    isDefault: true,
    contextWindow: 128000,
    temperature: 0.9,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('stores/model.store — add/edit/delete/setDefault', () => {
  beforeEach(async () => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    // Clear in-memory store
    const store = useModelStore()
    store.$patch({ models: [], currentModelId: null })
    // Clear the mocked repository's internal store
    const repoStore = (ModelRepository.save as any).__v_store
    if (!repoStore) {
      // Access the closure: we need to call findAll before any save to check
    }
    // Reset by deleting all known entries via the mocked delete
    const all = await ModelRepository.findAll()
    for (const m of all) {
      await ModelRepository.delete(m.id)
    }
  })

  it('addModel should add to models array', async () => {
    const store = useModelStore()
    const model = makeModel({ id: 'm1' })

    await store.addModel(model)

    expect(store.models).toHaveLength(1)
    expect(store.models[0].name).toBe('GPT-4')
  })

  it('addModel should unset existing defaults when new model is default', async () => {
    const store = useModelStore()
    const existing = makeModel({ id: 'm1', isDefault: true, name: 'Old Default' })
    await ModelRepository.save(existing)
    await store.loadModels()

    const newcomer = makeModel({ id: 'm2', isDefault: true, name: 'New Default' })
    await store.addModel(newcomer)

    const oldM = store.models.find(m => m.id === 'm1')
    const newM = store.models.find(m => m.id === 'm2')
    expect(oldM?.isDefault).toBe(false)
    expect(newM?.isDefault).toBe(true)
  })

  it('editModel should update existing model', async () => {
    const store = useModelStore()
    const model = makeModel({ id: 'm1', name: 'GPT-4' })
    await ModelRepository.save(model)
    await store.loadModels()

    const updated = { ...model, name: 'GPT-4 Turbo', updatedAt: '2026-06-28T00:00:00.000Z' }
    await store.editModel(updated)

    expect(store.models[0].name).toBe('GPT-4 Turbo')
  })

  it('duplicateModel should create a copied model with reset test state', async () => {
    const store = useModelStore()
    const model = makeModel({
      id: 'm1',
      name: 'Claude 3.5',
      lastTestStatus: 'success',
      lastTestLatency: 88,
      lastTestError: 'old-error',
      lastUsedAt: '2026-06-28T00:00:00.000Z',
    })
    await ModelRepository.save(model)
    await store.loadModels()

    const duplicated = await store.duplicateModel('m1')

    expect(duplicated).not.toBeNull()
    expect(duplicated?.id).not.toBe('m1')
    expect(duplicated?.name).toBe('Claude 3.5 副本')
    expect(duplicated?.isDefault).toBe(false)
    expect(duplicated?.lastTestStatus).toBe('untested')
    expect(duplicated?.lastTestLatency).toBeUndefined()
    expect(duplicated?.lastTestError).toBeUndefined()
    expect(duplicated?.lastUsedAt).toBeUndefined()
    expect(store.models).toHaveLength(2)
  })

  it('duplicateModel should append index when copied name already exists', async () => {
    const store = useModelStore()
    await ModelRepository.save(makeModel({ id: 'm1', name: 'DeepSeek Chat' }))
    await ModelRepository.save(makeModel({ id: 'm2', name: 'DeepSeek Chat 副本', isDefault: false }))
    await store.loadModels()

    const duplicated = await store.duplicateModel('m1')

    expect(duplicated?.name).toBe('DeepSeek Chat 副本 2')
  })

  it('editModel should unset defaults when another model becomes default', async () => {
    const store = useModelStore()
    const m1 = makeModel({ id: 'm1', isDefault: true, name: 'First' })
    const m2 = makeModel({ id: 'm2', isDefault: false, name: 'Second' })
    await ModelRepository.save(m1)
    await ModelRepository.save(m2)
    await store.loadModels()

    await store.editModel({ ...m2, isDefault: true, updatedAt: '2026-06-28T00:00:00.000Z' })

    expect(store.models.find(m => m.id === 'm1')?.isDefault).toBe(false)
    expect(store.models.find(m => m.id === 'm2')?.isDefault).toBe(true)
  })

  it('toggleEnabled should disable a non-default model', async () => {
    const store = useModelStore()
    const m1 = makeModel({ id: 'm1', isDefault: true, enabled: true })
    const m2 = makeModel({ id: 'm2', isDefault: false, enabled: true, name: 'Second' })
    await ModelRepository.save(m1)
    await ModelRepository.save(m2)
    await store.loadModels()

    const result = await store.toggleEnabled('m2', false)

    expect(result).toEqual({ success: true })
    expect(store.models.find(m => m.id === 'm2')?.enabled).toBe(false)
  })

  it('toggleEnabled should block disabling default model', async () => {
    const store = useModelStore()
    const m1 = makeModel({ id: 'm1', isDefault: true, enabled: true })
    const m2 = makeModel({ id: 'm2', isDefault: false, enabled: true, name: 'Second' })
    await ModelRepository.save(m1)
    await ModelRepository.save(m2)
    await store.loadModels()

    const result = await store.toggleEnabled('m1', false)

    expect(result).toEqual({ success: false, reason: 'default-model' })
    expect(store.models.find(m => m.id === 'm1')?.enabled).toBe(true)
  })

  it('toggleEnabled should block disabling last enabled model', async () => {
    const store = useModelStore()
    const m1 = makeModel({ id: 'm1', isDefault: false, enabled: true })
    await ModelRepository.save(m1)
    await store.loadModels()

    const result = await store.toggleEnabled('m1', false)

    expect(result).toEqual({ success: false, reason: 'last-enabled' })
    expect(store.models.find(m => m.id === 'm1')?.enabled).toBe(true)
  })

  it('toggleEnabled should switch current model when current one is disabled', async () => {
    const store = useModelStore()
    const m1 = makeModel({ id: 'm1', isDefault: true, enabled: true, name: 'Default' })
    const m2 = makeModel({ id: 'm2', isDefault: false, enabled: true, name: 'Second' })
    const m3 = makeModel({ id: 'm3', isDefault: false, enabled: true, name: 'Third' })
    await ModelRepository.save(m1)
    await ModelRepository.save(m2)
    await ModelRepository.save(m3)
    await store.loadModels()
    store.selectModel('m2')

    const result = await store.toggleEnabled('m2', false)

    expect(result).toEqual({ success: true })
    expect(store.currentModelId).toBe('m1')
    expect(store.selectedModelIds).not.toContain('m2')
  })

  it('deleteModel should remove model', async () => {
    const store = useModelStore()
    const m1 = makeModel({ id: 'm1' })
    const m2 = makeModel({ id: 'm2', isDefault: false })
    await ModelRepository.save(m1)
    await ModelRepository.save(m2)
    await store.loadModels()

    await store.deleteModel('m1')

    expect(store.models).toHaveLength(1)
    expect(store.models[0].id).toBe('m2')
  })

  it('deleteModel should clear currentModelId if deleted', async () => {
    const store = useModelStore()
    await ModelRepository.save(makeModel({ id: 'm1' }))
    await store.loadModels()
    store.selectModel('m1')

    await store.deleteModel('m1')

    expect(store.currentModelId).toBeNull()
  })

  it('selectModel should set currentModelId', () => {
    const store = useModelStore()
    store.selectModel('m1')
    expect(store.currentModelId).toBe('m1')
  })

  it('testConnection should set status and handle success', async () => {
    vi.mocked(mockTestConnection).mockResolvedValueOnce({ success: true, latency: 120 })

    const store = useModelStore()
    const model = makeModel({ id: 'm1' })
    await ModelRepository.save(model)
    await store.loadModels()

    await store.testConnection('m1')

    const updated = store.models.find(m => m.id === 'm1')
    expect(updated?.lastTestStatus).toBe('success')
    expect(updated?.lastTestLatency).toBe(120)
    expect(updated?.lastTestError).toBeUndefined()
  })

  it('testConnection should set failed status on error', async () => {
    vi.mocked(mockTestConnection).mockResolvedValueOnce({ success: false, latency: 300, error: 'timeout' })

    const store = useModelStore()
    const model = makeModel({ id: 'm1' })
    await ModelRepository.save(model)
    await store.loadModels()

    await store.testConnection('m1')

    const updated = store.models.find(m => m.id === 'm1')
    expect(updated?.lastTestStatus).toBe('failed')
    expect(updated?.lastTestError).toBe('timeout')
  })

  it('testConnection should return false for non-existent model', async () => {
    const store = useModelStore()
    const result = await store.testConnection('nonexistent')
    expect(result).toBe(false)
  })

  it('duplicateModel should return null for non-existent model', async () => {
    const store = useModelStore()
    const duplicated = await store.duplicateModel('missing')
    expect(duplicated).toBeNull()
  })

  it('toggleEnabled should return not-found for non-existent model', async () => {
    const store = useModelStore()
    const result = await store.toggleEnabled('missing', false)
    expect(result).toEqual({ success: false, reason: 'not-found' })
  })
})
