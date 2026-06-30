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

export interface AutoAnalysisSettings {
  enabled: boolean
  /** ModelConfig.id; falls back to the default model when unset. */
  modelId?: string
  /** PromptTemplate.id whose content becomes the auto prompt. */
  promptTemplateId?: string
}

export interface AppSettings {
  id: 'app-settings'

  globalSystemPrompt?: string

  context: ContextSettings
  capture: CaptureSettings
  autoAnalysis: AutoAnalysisSettings

  createdAt: string
  updatedAt: string
}
