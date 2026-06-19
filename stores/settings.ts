import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import type { ProviderConfig, ProviderSettings } from '@/utils/llm/types';
import { browser } from 'wxt/browser';

const STORAGE_KEY = 'ai-reader-settings';

const DEFAULT_SETTINGS: ProviderSettings = {
  providers: {
    openai: {
      apiKey: '',
      baseUrl: 'https://api.openai.com',
      model: 'gpt-4o-mini',
    },
    anthropic: {
      apiKey: '',
      baseUrl: 'https://api.anthropic.com',
      model: 'claude-sonnet-4-20250514',
    },
    gemini: {
      apiKey: '',
      baseUrl: 'https://generativelanguage.googleapis.com',
      model: 'gemini-2.0-flash',
    },
    ollama: {
      apiKey: '',
      baseUrl: 'http://localhost:11434',
      model: 'llama3',
    },
    custom: {
      apiKey: '',
      baseUrl: '',
      model: '',
    },
  },
  enabledProviders: ['openai'],
};

export const useSettingsStore = defineStore('settings', () => {
  const providers = ref<Record<string, ProviderConfig>>({ ...DEFAULT_SETTINGS.providers });
  const enabledProviders = ref<string[]>([...DEFAULT_SETTINGS.enabledProviders]);

  async function load() {
    const data = await browser.storage.local.get(STORAGE_KEY);
    const saved = data[STORAGE_KEY] as ProviderSettings | undefined;
    if (saved) {
      providers.value = { ...DEFAULT_SETTINGS.providers, ...saved.providers };
      enabledProviders.value = saved.enabledProviders || ['openai'];
    }
  }

  async function save() {
    await browser.storage.local.set({
      [STORAGE_KEY]: {
        providers: providers.value,
        enabledProviders: enabledProviders.value,
      } satisfies ProviderSettings,
    });
  }

  function getProviderConfig(id: string): ProviderConfig {
    return providers.value[id] || DEFAULT_SETTINGS.providers[id] || { apiKey: '', baseUrl: '', model: '' };
  }

  function updateProvider(id: string, config: Partial<ProviderConfig>) {
    providers.value[id] = { ...getProviderConfig(id), ...config };
  }

  function toggleProvider(id: string) {
    const idx = enabledProviders.value.indexOf(id);
    if (idx >= 0) {
      enabledProviders.value.splice(idx, 1);
    } else {
      enabledProviders.value.push(id);
    }
  }

  // Auto-save on changes
  watch([providers, enabledProviders], save, { deep: true });

  // Load on init
  load();

  return {
    providers,
    enabledProviders,
    load,
    save,
    getProviderConfig,
    updateProvider,
    toggleProvider,
  };
});
