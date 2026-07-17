import dayjs from 'dayjs'
import { defineStore } from 'pinia'
import { ref, computed, toRaw } from 'vue'
import { ModelRepository } from '../db/repositories/model.repository'
import type { ModelConfig } from '../types/model'
import { testConnection as runTestConnection } from '../services/ai/test-connection.service'

function generateUUID(): string {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

export interface ToggleEnabledResult {
  success: boolean
  reason?: 'not-found' | 'default-model' | 'last-enabled'
}

export const useModelStore = defineStore('model', () => {
  const models = ref<ModelConfig[]>([])
  const currentModelId = ref<string | null>(null)
  const selectedModelIds = ref<string[]>([])

  const currentModel = computed(() =>
    models.value.find((m) => m.id === currentModelId.value) ?? null,
  )

  const selectedModels = computed(() =>
    models.value.filter((m) => selectedModelIds.value.includes(m.id)),
  )

  const enabledModels = computed(() =>
    models.value.filter((m) => m.enabled),
  )

  const defaultModel = computed(() =>
    models.value.find((m) => m.isDefault) ?? null,
  )

  async function loadModels() {
    models.value = await ModelRepository.findAll()
  }

  async function addModel(model: ModelConfig) {
    if (model.isDefault) {
      for (const m of models.value) {
        if (m.isDefault && m.id !== model.id) {
          m.isDefault = false
          await ModelRepository.save(toRaw(m) as ModelConfig)
        }
      }
    }
    await ModelRepository.save(toRaw(model) as ModelConfig)
    await loadModels()
  }

  function generateDuplicateName(sourceName: string) {
    const trimmedName = sourceName.trim() || '模型'
    const baseName = `${trimmedName} 副本`
    const existingNames = new Set(models.value.map(model => model.name))

    if (!existingNames.has(baseName)) {
      return baseName
    }

    let index = 2
    while (existingNames.has(`${baseName} ${index}`)) {
      index += 1
    }

    return `${baseName} ${index}`
  }

  async function duplicateModel(id: string): Promise<ModelConfig | null> {
    const source = models.value.find(model => model.id === id)
    if (!source) return null

    const now = dayjs().toISOString()
    const duplicatedModel: ModelConfig = {
      ...toRaw(source),
      id: generateUUID(),
      name: generateDuplicateName(source.name),
      isDefault: false,
      lastTestStatus: 'untested',
      lastTestLatency: undefined,
      lastTestError: undefined,
      lastUsedAt: undefined,
      createdAt: now,
      updatedAt: now,
    }

    await ModelRepository.save(duplicatedModel)
    await loadModels()
    return duplicatedModel
  }

  async function editModel(model: ModelConfig) {
    if (model.isDefault) {
      for (const m of models.value) {
        if (m.isDefault && m.id !== model.id) {
          m.isDefault = false
          await ModelRepository.save(toRaw(m) as ModelConfig)
        }
      }
    }
    await ModelRepository.save(toRaw(model) as ModelConfig)
    await loadModels()
  }

  async function toggleEnabled(id: string, enabled: boolean): Promise<ToggleEnabledResult> {
    const model = models.value.find(m => m.id === id)
    if (!model) {
      return { success: false, reason: 'not-found' }
    }

    if (model.enabled === enabled) {
      return { success: true }
    }

    const enabledModelsBeforeToggle = models.value.filter(m => m.enabled)
    if (!enabled) {
      if (model.isDefault) {
        return { success: false, reason: 'default-model' }
      }

      if (enabledModelsBeforeToggle.length <= 1) {
        return { success: false, reason: 'last-enabled' }
      }
    }

    await ModelRepository.save({
      ...toRaw(model),
      enabled,
      updatedAt: dayjs().toISOString(),
    } as ModelConfig)
    await loadModels()

    if (!enabled) {
      selectedModelIds.value = selectedModelIds.value.filter(mid => mid !== id)

      if (currentModelId.value === id) {
        const fallbackModel = defaultModel.value?.enabled
          ? defaultModel.value
          : models.value.find(m => m.enabled) ?? null
        currentModelId.value = fallbackModel?.id ?? null
      }
    }

    return { success: true }
  }

  async function deleteModel(id: string) {
    await ModelRepository.delete(id)
    if (currentModelId.value === id) currentModelId.value = null
    await loadModels()
  }

  function selectModel(id: string) {
    currentModelId.value = id
    selectedModelIds.value = [id]
  }

  function toggleModelSelection(id: string) {
    const idx = selectedModelIds.value.indexOf(id)
    if (idx === -1) {
      selectedModelIds.value = [...selectedModelIds.value, id]
    } else {
      selectedModelIds.value = selectedModelIds.value.filter((mid) => mid !== id)
    }
    if (selectedModelIds.value.length === 1) {
      currentModelId.value = selectedModelIds.value[0]
    } else {
      currentModelId.value = null
    }
  }

  function setSelectedModelIds(ids: string[]) {
    selectedModelIds.value = ids
    if (ids.length === 1) {
      currentModelId.value = ids[0]
    } else {
      currentModelId.value = null
    }
  }

  async function testConnection(id: string): Promise<boolean> {
    const model = models.value.find(m => m.id === id)
    if (!model) return false

    model.lastTestStatus = 'testing'
    model.lastTestError = undefined
    model.lastTestLatency = undefined

    try {
      const result = await runTestConnection(model)
      model.lastTestStatus = result.success ? 'success' : 'failed'
      model.lastTestLatency = result.latency
      model.lastTestError = result.error
      return result.success
    } catch (e: any) {
      model.lastTestStatus = 'failed'
      model.lastTestError = e?.message ?? String(e)
      return false
    }
  }

  return {
    models,
    currentModelId,
    selectedModelIds,
    currentModel,
    selectedModels,
    enabledModels,
    defaultModel,
    loadModels,
    addModel,
    duplicateModel,
    editModel,
    toggleEnabled,
    deleteModel,
    selectModel,
    toggleModelSelection,
    setSelectedModelIds,
    testConnection,
  }
}, {
  persist: {
    pick: ['currentModelId', 'selectedModelIds'],
  },
})
