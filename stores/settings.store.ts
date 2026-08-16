import dayjs from 'dayjs'
import { defineStore } from 'pinia'
import { ref, toRaw } from 'vue'
import { SettingsRepository } from '../db/repositories/settings.repository'
import { MetaRepository } from '../db/repositories/meta.repository'
import type { AppSettings, ContextSettings, CaptureSettings, AutoAnalysisSettings, InboxSettings, TaggingSettings, ReviewSettings } from '../types/settings'
import type { AnkiConnectConfig, TranscribeConfig } from '../types/settings'
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

const defaultInboxSettings: InboxSettings = { endpoint: '', token: '', enabled: false }

const defaultTaggingSettings: TaggingSettings = { autoTagOnCapture: false }

const defaultReviewSettings: ReviewSettings = { newCardsPerDay: 0 }

function createDefaultSettings(): AppSettings {
  return {
    id: 'app-settings',
    globalSystemPrompt: '',
    context: { ...defaultContextSettings },
    capture: { ...defaultCaptureSettings },
    autoAnalysis: { ...defaultAutoAnalysisSettings },
    inbox: { ...defaultInboxSettings },
    tagging: { ...defaultTaggingSettings },
    review: { ...defaultReviewSettings },
    createdAt: dayjs().toISOString(),
    updatedAt: dayjs().toISOString(),
  }
}

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<AppSettings>(createDefaultSettings())
  const isLoaded = ref(false)
  const webdav = ref<WebDAVConfig>({ url: '', username: '', password: '', basePath: '/auramind', enabled: false, maxBackups: 10 })
  const s3 = ref<S3Config>({ endpoint: '', bucket: '', region: 'us-east-1', accessKeyId: '', secretAccessKey: '', basePath: '/auramind', enabled: false, forcePathStyle: false, maxBackups: 10 })
  const anki = ref<AnkiConnectConfig>({ url: 'http://127.0.0.1:8765', deck: 'AuraMind' })
  const transcribe = ref<TranscribeConfig>({ baseUrl: 'https://api.openai.com/v1', apiKey: '', model: 'whisper-1' })
  const theme = ref<'light' | 'dark' | 'system'>('system')

  async function loadSettings() {
    const saved = await SettingsRepository.get()
    if (saved) {
      // Merge defaults so settings saved before a field group existed get it.
      settings.value = {
        ...createDefaultSettings(),
        ...saved,
        inbox: { ...defaultInboxSettings, ...saved.inbox },
        tagging: { ...defaultTaggingSettings, ...saved.tagging },
        review: { ...defaultReviewSettings, ...saved.review },
      }
    }
    const savedWebdav = await MetaRepository.get<WebDAVConfig>('webdav-config')
    if (savedWebdav) webdav.value = { ...webdav.value, ...savedWebdav }
    const savedS3 = await MetaRepository.get<S3Config>('s3-config')
    if (savedS3) s3.value = { ...s3.value, ...savedS3 }
    const savedAnki = await MetaRepository.get<AnkiConnectConfig>('anki-config')
    if (savedAnki) anki.value = { ...anki.value, ...savedAnki }
    const savedTranscribe = await MetaRepository.get<TranscribeConfig>('transcribe-config')
    if (savedTranscribe) transcribe.value = { ...transcribe.value, ...savedTranscribe }
    const savedTheme = await MetaRepository.get<'light' | 'dark' | 'system'>('theme')
    if (savedTheme) theme.value = savedTheme
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

  async function updateAnkiConfig(partial: Partial<AnkiConnectConfig>) {
    anki.value = { ...anki.value, ...partial }
    await MetaRepository.set('anki-config', toRaw(anki.value))
  }

  async function updateTranscribeConfig(partial: Partial<TranscribeConfig>) {
    transcribe.value = { ...transcribe.value, ...partial }
    await MetaRepository.set('transcribe-config', toRaw(transcribe.value))
  }

  async function updateTheme(value: 'light' | 'dark' | 'system') {
    theme.value = value
    await MetaRepository.set('theme', value)
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

  async function updateInboxSettings(partial: Partial<InboxSettings>) {
    settings.value.inbox = { ...settings.value.inbox, ...partial }
    settings.value.updatedAt = dayjs().toISOString()
    await persist()
  }

  async function updateTaggingSettings(partial: Partial<TaggingSettings>) {
    settings.value.tagging = { ...settings.value.tagging, ...partial }
    settings.value.updatedAt = dayjs().toISOString()
    await persist()
  }

  async function updateReviewSettings(partial: Partial<ReviewSettings>) {
    settings.value.review = { ...settings.value.review, ...partial }
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
    anki,
    transcribe,
    theme,
    loadSettings,
    updateWebDAVConfig,
    updateS3Config,
    updateAnkiConfig,
    updateTranscribeConfig,
    updateTheme,
    updateGlobalSystemPrompt,
    updateContextSettings,
    updateCaptureSettings,
    updateAutoAnalysis,
    updateInboxSettings,
    updateTaggingSettings,
    updateReviewSettings,
    persist,
  }
})
