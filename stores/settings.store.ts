import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { STORE_KEYS, type ProviderConfig, type Settings, defaultSettings } from '@/modules/storage/types';
import { chromeStorageLocal } from './chrome-storage';

export const useSettingsStore = defineStore(
  'settings',
  () => {
    const settings = ref<Settings>({ ...defaultSettings });

    const apiKeyWarning = computed(() => {
      const hasPlaintext = settings.value.providers.some((p) => p.apiKey && p.storage !== 'encrypted');
      return hasPlaintext ? 'API Key 以明文存储在本地浏览器，请勿在公共/共享设备使用。' : '';
    });

    function setSettings(next: Partial<Settings>) {
      settings.value = { ...settings.value, ...next };
    }

    function addProvider(provider: ProviderConfig) {
      settings.value.providers = [...settings.value.providers, provider];
    }

    function updateProvider(id: string, patch: Partial<ProviderConfig>) {
      settings.value.providers = settings.value.providers.map((p) => (p.id === id ? { ...p, ...patch } : p));
    }

    function removeProvider(id: string) {
      settings.value.providers = settings.value.providers.filter((p) => p.id !== id);
    }

    /** Export settings, excluding apiKey by default. */
    function exportSettings(includeApiKeys = false): string {
      const clone: Settings = JSON.parse(JSON.stringify(settings.value));
      if (!includeApiKeys) {
        clone.providers = clone.providers.map((p) => ({ ...p, apiKey: '' }));
      }
      return JSON.stringify(clone, null, 2);
    }

    function reset() {
      settings.value = { ...defaultSettings };
    }

    return {
      settings,
      apiKeyWarning,
      setSettings,
      addProvider,
      updateProvider,
      removeProvider,
      exportSettings,
      reset,
    };
  },
  {
    persist: {
      storage: chromeStorageLocal(STORE_KEYS.settings) as unknown as Storage,
      pick: ['settings'],
    },
  },
);
