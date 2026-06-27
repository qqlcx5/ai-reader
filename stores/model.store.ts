import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { ModelRepository } from '../db/repositories/model.repository'
import type { ModelConfig } from '../types/model'

export const useModelStore = defineStore('model', () => {
  const models = ref<ModelConfig[]>([])
  const currentModelId = ref<string | null>(null)

  const currentModel = computed(() =>
    models.value.find((m) => m.id === currentModelId.value) ?? null,
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
  }

  async function testConnection(_modelId: string): Promise<boolean> {
    // placeholder: actual implementation in ai-provider module
    return true
  }

  return {
    models,
    currentModelId,
    currentModel,
    defaultModel,
    loadModels,
    addModel,
    editModel,
    deleteModel,
    selectModel,
    testConnection,
  }
})
