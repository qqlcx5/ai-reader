import dayjs from 'dayjs'
import { defineStore } from 'pinia'
import { ref, toRaw } from 'vue'
import { SettingsRepository } from '../db/repositories/settings.repository'
import { MetaRepository } from '../db/repositories/meta.repository'
import type { AppSettings, ContextSettings, CaptureSettings, AutoAnalysisSettings } from '../types/settings'
import type { WebDAVConfig } from '../types/sync'
import type { S3Config } from '../types/s3'

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

const defaultAutoAnalysisSettings: AutoAnalysisSettings = {}

function createDefaultSettings(): AppSettings {
  return {
    id: 'app-settings',
    globalSystemPrompt: '',
    context: { ...defaultContextSettings },
    capture: { ...defaultCaptureSettings },
    autoAnalysis: { ...defaultAutoAnalysisSettings },
    createdAt: dayjs().toISOString(),
    updatedAt: dayjs().toISOString(),
  }
}

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<AppSettings>(createDefaultSettings())
  const isLoaded = ref(false)
  const webdav = ref<WebDAVConfig>({ url: '', username: '', password: '', basePath: '/auramind', enabled: false, maxBackups: 10 })
  const s3 = ref<S3Config>({ endpoint: '', bucket: '', region: 'us-east-1', accessKeyId: '', secretAccessKey: '', basePath: '/auramind', enabled: false, forcePathStyle: false, maxBackups: 10 })

  async function loadSettings() {
    const saved = await SettingsRepository.get()
    if (saved) {
      settings.value = saved
    }
    const savedWebdav = await MetaRepository.get<WebDAVConfig>('webdav-config')
    if (savedWebdav) webdav.value = { ...webdav.value, ...savedWebdav }
    const savedS3 = await MetaRepository.get<S3Config>('s3-config')
    if (savedS3) s3.value = { ...s3.value, ...savedS3 }
    isLoaded.value = true
  }

  async function updateWebDAVConfig(partial: Partial<WebDAVConfig>) {
    webdav.value = { ...webdav.value, ...partial }
    await MetaRepository.set('webdav-config', toRaw(webdav.value))
  }

  async function updateS3Config(partial: Partial<S3Config>) {
    s3.value = { ...s3.value, ...partial }
    await MetaRepository.set('s3-config', toRaw(s3.value))
  }

  async function updateGlobalSystemPrompt(prompt: string) {
    settings.value.globalSystemPrompt = prompt
    settings.value.updatedAt = dayjs().toISOString()
    await persist()
  }

  async function updateContextSettings(partial: Partial<ContextSettings>) {
    settings.value.context = { ...settings.value.context, ...partial }
    settings.value.updatedAt = dayjs().toISOString()
    await persist()
  }

  async function updateCaptureSettings(partial: Partial<CaptureSettings>) {
    settings.value.capture = { ...settings.value.capture, ...partial }
    settings.value.updatedAt = dayjs().toISOString()
    await persist()
  }

  async function updateAutoAnalysis(partial: Partial<AutoAnalysisSettings>) {
    settings.value.autoAnalysis = { ...settings.value.autoAnalysis, ...partial }
    settings.value.updatedAt = dayjs().toISOString()
    await persist()
  }

  async function persist() {
    await SettingsRepository.save(toRaw(settings.value) as AppSettings)
  }

  return {
    settings,
    isLoaded,
    webdav,
    s3,
    loadSettings,
    updateWebDAVConfig,
    updateS3Config,
    updateGlobalSystemPrompt,
    updateContextSettings,
    updateCaptureSettings,
    updateAutoAnalysis,
    persist,
  }
})
