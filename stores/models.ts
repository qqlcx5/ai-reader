/**
 * 模型状态管理
 */
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { ModelProviderConfig } from '@/shared/types';
import {
  listModels,
  listEnabledModels,
  putModel as saveModel,
  deleteModel as removeModel,
  getModel as fetchModel,
  newModelId,
} from '@/db/model-repository';
import { getAppSettings, setAppSettings } from '@/db/dexie';
import { sendMessage } from '@/shared/messaging/runtime-client';
import { MessageType } from '@/shared/messaging/messages';

export const useModelsStore = defineStore('models', () => {
  const models = ref<ModelProviderConfig[]>([]);
  const defaultModelId = ref<string | undefined>(undefined);
  const loading = ref(false);

  const enabledModels = computed(() => models.value.filter((m) => m.enabled));

  async function loadModels(): Promise<void> {
    loading.value = true;
    try {
      models.value = await listModels();
      const settings = await getAppSettings();
      defaultModelId.value = settings.defaultModelId;
    } finally {
      loading.value = false;
    }
  }

  async function loadEnabledModels(): Promise<ModelProviderConfig[]> {
    const enabled = await listEnabledModels();
    return enabled;
  }

  async function saveModelConfig(model: ModelProviderConfig): Promise<void> {
    await saveModel(model);
    await loadModels();
  }

  async function removeModelById(id: string): Promise<void> {
    await removeModel(id);
    if (defaultModelId.value === id) {
      defaultModelId.value = undefined;
    }
    await loadModels();
  }

  async function setDefault(id: string): Promise<void> {
    const settings = await getAppSettings();
    await setAppSettings({ ...settings, defaultModelId: id });
    defaultModelId.value = id;
  }

  async function ping(modelId: string): Promise<{ success: boolean; message?: string }> {
    const res = await sendMessage(MessageType.PING_MODEL, { modelId });
    if (!res.success) return { success: false, message: res.error };
    return res.data as { success: boolean; message?: string };
  }

  function createBlank(): ModelProviderConfig {
    return {
      id: newModelId(),
      name: '',
      provider: 'openai-compatible',
      enabled: true,
      apiKey: '',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-3.5-turbo',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  return {
    models,
    enabledModels,
    defaultModelId,
    loading,
    loadModels,
    loadEnabledModels,
    saveModelConfig,
    removeModelById,
    setDefault,
    ping,
    createBlank,
  };
});
