import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { AppSettings } from '@/domain'
import { DEFAULT_SETTINGS } from '@/domain'
import * as settingsRepo from '@/db/settings.repository'

// ============================================================
// PageMind — Settings Pinia Store
// ============================================================

export const useSettingsStore = defineStore('settings', () => {
  // ---- State ----
  const settings = ref<AppSettings>({ ...DEFAULT_SETTINGS })
  const loading = ref(false)

  async function loadSettings() {
    loading.value = true
    try {
      settings.value = await settingsRepo.getSettings()
    } finally {
      loading.value = false
    }
  }

  async function updateSettings(partial: Partial<AppSettings>) {
    settings.value = await settingsRepo.updateSettings(partial)
  }

  async function resetSettings() {
    settings.value = await settingsRepo.resetSettings()
  }

  return {
    settings,
    loading,
    loadSettings,
    updateSettings,
    resetSettings,
  }
})
