import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { ModelRepository } from '../db/repositories/model.repository'
import type { ModelConfig } from '../types/model'
import { testConnection as runTestConnection } from '../services/ai/test-connection.service'

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
      // unset existing defaults
      for (const m of models.value) {
        if (m.isDefault && m.id !== model.id) {
          m.isDefault = false
          await ModelRepository.save(m)
        }
      }
    }
    await ModelRepository.save(model)
    await loadModels()
  }

  async function editModel(model: ModelConfig) {
    if (model.isDefault) {
      for (const m of models.value) {
        if (m.isDefault && m.id !== model.id) {
          m.isDefault = false
          await ModelRepository.save(m)
        }
      }
    }
    await ModelRepository.save(model)
    await loadModels()
  }

  async function deleteModel(id: string) {
    await ModelRepository.delete(id)
    if (currentModelId.value === id) currentModelId.value = null
    await loadModels()
  }

  function selectModel(id: string) {
    currentModelId.value = id
    // Sync single-select to multi-select for consistency
    selectedModelIds.value = [id]
  }

  function toggleModelSelection(id: string) {
    const idx = selectedModelIds.value.indexOf(id)
    if (idx === -1) {
      selectedModelIds.value = [...selectedModelIds.value, id]
    } else {
      selectedModelIds.value = selectedModelIds.value.filter((mid) => mid !== id)
    }
    // Sync: if only 1 selected, also set as currentModelId
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

    // Set testing status
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
    editModel,
    deleteModel,
    selectModel,
    toggleModelSelection,
    setSelectedModelIds,
    testConnection,
  }
})
