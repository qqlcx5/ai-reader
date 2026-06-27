export interface ContextSettings {
  maxContextTokens: number

  includeMetadataInPrompt: boolean
  includeUrlInPrompt: boolean
  includeTitleInPrompt: boolean
  includeCapturedAtInPrompt: boolean

  includeConversationHistory: boolean
  maxHistoryMessages: number
}

export interface CaptureSettings {
  autoExtractOnOpen: boolean
  autoExtractOnTabChange: boolean
  preferCache: boolean

  saveRawHtml: boolean
  compressRawHtml: boolean
}

export interface AppSettings {
  id: 'app-settings'

  globalSystemPrompt?: string

  context: ContextSettings
  capture: CaptureSettings

  createdAt: string
  updatedAt: string
}
