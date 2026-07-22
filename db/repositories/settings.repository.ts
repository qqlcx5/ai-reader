import dayjs from 'dayjs'
import { db } from '../index'
import type { AppSettings, ContextSettings, CaptureSettings } from '../../types/settings'
import type { IRepository } from '../repository'

const defaultContextSettings: ContextSettings = {
  maxContextTokens: 128000,
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

export const SettingsRepository: IRepository<AppSettings> & {
  get(): Promise<AppSettings | undefined>
  migrate(oldVersion: number): Promise<void>
} = {
  async findById(id: string): Promise<AppSettings | undefined> {
    return db.settings.get(id as 'app-settings')
  },

  async findAll(): Promise<AppSettings[]> {
    return db.settings.toArray()
  },

  async get(): Promise<AppSettings | undefined> {
    return db.settings.get('app-settings')
  },

  async save(settings: AppSettings): Promise<AppSettings> {
    await db.settings.put(settings)
    return settings
  },

  async delete(id: string): Promise<void> {
    await db.settings.delete(id as 'app-settings')
  },

  async count(): Promise<number> {
    return db.settings.count()
  },

  async migrate(oldVersion: number): Promise<void> {
    const existing = await db.settings.get('app-settings')
    if (!existing) return

    // Merge missing defaults for context
    const merged: AppSettings = {
      id: 'app-settings',
      globalSystemPrompt: existing.globalSystemPrompt ?? '',
      context: {
        ...defaultContextSettings,
        ...existing.context,
      },
      capture: {
        ...defaultCaptureSettings,
        ...existing.capture,
      },
      autoAnalysis: {
        queuePaused: existing.autoAnalysis?.queuePaused,
      },
      createdAt: existing.createdAt || dayjs().toISOString(),
      updatedAt: dayjs().toISOString(),
    }

    await db.settings.put(merged)
  },
}
