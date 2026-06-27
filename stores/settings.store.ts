import { defineStore } from 'pinia'
import { ref } from 'vue'
import { SettingsRepository } from '../db/repositories/settings.repository'
import type { AppSettings, ContextSettings, CaptureSettings } from '../types/settings'

const defaultContextSettings: ContextSettings = {
  maxContextTokens: 8000,
  includeMetadataInPrompt: true,
  includeUrlInPrompt: true,
  includeTitleInPrompt: true,
  includeCapturedAtInPrompt: false,
  includeConversationHistory: true,
  maxHistoryMessages: 20,
}

const defaultCaptureSettings: CaptureSettings = {
  autoExtractOnOpen: true,
  autoExtractOnTabChange: false,
  preferCache: true,
  saveRawHtml: false,
  compressRawHtml: true,
}

function createDefaultSettings(): AppSettings {
  return {
    id: 'app-settings',
    globalSystemPrompt: '',
    context: { ...defaultContextSettings },
    capture: { ...defaultCaptureSettings },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<AppSettings>(createDefaultSettings())
  const isLoaded = ref(false)

  async function loadSettings() {
    const saved = await SettingsRepository.get()
    if (saved) {
      settings.value = saved
    }
    isLoaded.value = true
  }

  async function updateGlobalSystemPrompt(prompt: string) {
    settings.value.globalSystemPrompt = prompt
    settings.value.updatedAt = new Date().toISOString()
    await persist()
  }

  async function updateContextSettings(partial: Partial<ContextSettings>) {
    settings.value.context = { ...settings.value.context, ...partial }
    settings.value.updatedAt = new Date().toISOString()
    await persist()
  }

  async function updateCaptureSettings(partial: Partial<CaptureSettings>) {
    settings.value.capture = { ...settings.value.capture, ...partial }
    settings.value.updatedAt = new Date().toISOString()
    await persist()
  }

  async function persist() {
    await SettingsRepository.save(settings.value)
  }

  return {
    settings,
    isLoaded,
    loadSettings,
    updateGlobalSystemPrompt,
    updateContextSettings,
    updateCaptureSettings,
    persist,
  }
})
