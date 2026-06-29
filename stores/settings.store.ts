import { defineStore } from 'pinia'
import { ref, toRaw } from 'vue'
import { SettingsRepository } from '../db/repositories/settings.repository'
import { MetaRepository } from '../db/repositories/meta.repository'
import type { AppSettings, ContextSettings, CaptureSettings } from '../types/settings'
import type { WebDAVConfig } from '../types/sync'

const defaultContextSettings: ContextSettings = {
  maxContextTokens: 1050000,
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
  const webdav = ref<WebDAVConfig>({ url: '', username: '', password: '', basePath: '/auramind', enabled: false })

  async function loadSettings() {
    const saved = await SettingsRepository.get()
    if (saved) {
      settings.value = saved
    }
    const savedWebdav = await MetaRepository.get<WebDAVConfig>('webdav-config')
    if (savedWebdav) webdav.value = { ...webdav.value, ...savedWebdav }
    isLoaded.value = true
  }

  async function updateWebDAVConfig(partial: Partial<WebDAVConfig>) {
    webdav.value = { ...webdav.value, ...partial }
    await MetaRepository.set('webdav-config', toRaw(webdav.value))
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
    await SettingsRepository.save(toRaw(settings.value) as AppSettings)
  }

  return {
    settings,
    isLoaded,
    webdav,
    loadSettings,
    updateWebDAVConfig,
    updateGlobalSystemPrompt,
    updateContextSettings,
    updateCaptureSettings,
    persist,
  }
})
