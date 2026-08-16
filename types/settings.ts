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
  /** When true, the queue processor won't pick up new pending jobs.
   *  In-flight jobs finish normally. User-toggleable from the analysis panel.
   *
   *  This is the only knob left — auto-analysis is always "on" for newly
   *  captured/RSS docs. Model & template selection goes through routing rules,
   *  falling back to the global default model + system prompt. */
  queuePaused?: boolean
}

/** Newsletter inbox pull endpoint (self-hosted; see doc/newsletter-worker). */
export interface InboxSettings {
  /** GET endpoint returning { items, cursor } JSON. */
  endpoint: string
  /** Bearer token sent to the endpoint. */
  token: string
  enabled: boolean
}

export interface AppSettings {
  id: 'app-settings'

  globalSystemPrompt?: string

  context: ContextSettings
  capture: CaptureSettings
  autoAnalysis: AutoAnalysisSettings
  inbox: InboxSettings

  createdAt: string
  updatedAt: string
}
