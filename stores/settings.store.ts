import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { ModelProviderConfig, WebDAVConfig } from '@/db/schema';
import { modelRepository } from '@/core/models/model.repository';
import { db } from '@/db/dexie';
import { now } from '@/shared/utils/time';

const WEBDAV_CONFIG_KEY = 'webdav_config';
const GLOBAL_PROMPT_KEY = 'global_system_prompt';
const DEFAULT_PROMPT = '你是一个 AI 阅读助手。请根据以下网页内容回答用户的问题。';

export const useSettingsStore = defineStore('settings', () => {
  const models = ref<ModelProviderConfig[]>([]);
  const webdavConfig = ref<WebDAVConfig | null>(null);
  const globalSystemPrompt = ref(DEFAULT_PROMPT);

  const enabledModels = computed(() => models.value.filter((m) => m.enabled));

  async function loadModels() {
    models.value = await modelRepository.getAll();
  }

  async function loadWebDAVConfig() {
    const entry = await db.settings.get(WEBDAV_CONFIG_KEY);
    webdavConfig.value = (entry?.value as WebDAVConfig) ?? null;
  }

  async function loadGlobalPrompt() {
    const entry = await db.settings.get(GLOBAL_PROMPT_KEY);
    globalSystemPrompt.value = (entry?.value as string) ?? DEFAULT_PROMPT;
  }

  async function saveWebDAVConfig(config: WebDAVConfig) {
    await db.settings.put({
      key: WEBDAV_CONFIG_KEY,
      value: config,
      updatedAt: now(),
    });
    webdavConfig.value = config;
  }

  async function saveGlobalPrompt(prompt: string) {
    await db.settings.put({
      key: GLOBAL_PROMPT_KEY,
      value: prompt,
      updatedAt: now(),
    });
    globalSystemPrompt.value = prompt;
  }

  return {
    models,
    webdavConfig,
    globalSystemPrompt,
    enabledModels,
    loadModels,
    loadWebDAVConfig,
    loadGlobalPrompt,
    saveWebDAVConfig,
    saveGlobalPrompt,
  };
});
