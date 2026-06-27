import { defineStore } from 'pinia';
import type { AppSettings } from '../shared/domain';

const DEFAULT_SETTINGS: AppSettings = {
  autoSave: true,
  showToast: true,
  includeFrontmatter: true,
  readerStyle: 'light',
};

export const useSettingsStore = defineStore('settings', {
  state: () => ({
    settings: { ...DEFAULT_SETTINGS } as AppSettings,
    isLoaded: false,
  }),
  actions: {
    async load() {
      const result = await chrome.storage.local.get('appSettings');
      if (result.appSettings) {
        this.settings = { ...DEFAULT_SETTINGS, ...result.appSettings };
      }
      this.isLoaded = true;
    },
    async save() {
      await chrome.storage.local.set({ appSettings: this.settings });
    },
    async update(partial: Partial<AppSettings>) {
      this.settings = { ...this.settings, ...partial };
      await this.save();
    },
    reset() {
      this.settings = { ...DEFAULT_SETTINGS };
    },
  },
  persist: {
    storage: {
      getItem: async (key: string) => {
        const result = await chrome.storage.local.get(key);
        return result[key] ?? null;
      },
      setItem: async (key: string, value: unknown) => {
        await chrome.storage.local.set({ [key]: value });
      },
    },
  },
});
