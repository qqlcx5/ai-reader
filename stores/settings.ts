import { defineStore } from 'pinia';
import { ref, watch, toRaw } from 'vue';
import type { ProviderConfig, ProviderSettings } from '@/utils/llm/types';
import { browser } from 'wxt/browser';

const STORAGE_KEY = 'ai-reader-settings';

const DEFAULT_SETTINGS: ProviderSettings = {
  providers: {
    openai: {
      apiKey: 'sk-0FeSEKHeEIobWQYM3arOlSmfd8zbbPE1bhx6gofle9deZxkx',
      baseUrl: 'http://66.154.117.189:3000',
      model: 'mimo-v2.5-pro',
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
  const ready = ref(false);

  async function load() {
    const data = await browser.storage.local.get(STORAGE_KEY);
    const saved = data[STORAGE_KEY] as ProviderSettings | undefined;
    if (saved) {
      // Defensive: coerce to plain array (previous versions / bad writes
      // may have stored enabledProviders as a numeric-keyed object).
      const rawEnabled = Array.isArray(saved.enabledProviders)
        ? saved.enabledProviders
        : (saved.enabledProviders && typeof saved.enabledProviders === 'object'
            ? Object.values(saved.enabledProviders as Record<string, string>)
            : null);
      providers.value = { ...DEFAULT_SETTINGS.providers, ...(saved.providers || {}) };
      enabledProviders.value = rawEnabled && rawEnabled.length > 0
        ? rawEnabled
        : [...DEFAULT_SETTINGS.enabledProviders];
    }
    ready.value = true;
  }

  async function save() {
    // CRITICAL: Chrome's storage serializer does not recognize Vue's
    // reactive proxy as an Array and would store `["openai"]` as
    // `{"0":"openai"}`. Spread to plain values before persisting.
    const plainProviders: Record<string, ProviderConfig> = {};
    for (const [id, cfg] of Object.entries(toRaw(providers.value))) {
      plainProviders[id] = { ...toRaw(cfg) };
    }
    await browser.storage.local.set({
      [STORAGE_KEY]: {
        providers: plainProviders,
        enabledProviders: [...toRaw(enabledProviders.value)],
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

  // Debounced auto-save on changes
  let saveTimeout: ReturnType<typeof setTimeout> | null = null;
  watch([providers, enabledProviders], () => {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(save, 500);
  }, { deep: true });

  // Load on init
  load();

  return {
    providers,
    enabledProviders,
    ready,
    load,
    save,
    getProviderConfig,
    updateProvider,
    toggleProvider,
  };
});
