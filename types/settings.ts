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

/** Local AnkiConnect endpoint (Anki desktop + AnkiConnect add-on). Device-local. */
export interface AnkiConnectConfig {
  /** AnkiConnect server URL, default http://127.0.0.1:8765 */
  url: string
  /** Target deck name. Created when missing. */
  deck: string
}

/** Whisper-compatible transcription endpoint (OpenAI / Groq / SiliconFlow). Device-local secret. */
export interface TranscribeConfig {
  /** API base URL, e.g. https://api.openai.com/v1 */
  baseUrl: string
  apiKey: string
  /** Model name, e.g. whisper-1 */
  model: string
}

/** AI auto-tagging on capture. */
export interface TaggingSettings {
  /** Generate 3–5 AI tags right after a document is captured. */
  autoTagOnCapture: boolean
}

export interface AppSettings {
  id: 'app-settings'

  globalSystemPrompt?: string

  context: ContextSettings
  capture: CaptureSettings
  autoAnalysis: AutoAnalysisSettings
  inbox: InboxSettings
  tagging: TaggingSettings

  createdAt: string
  updatedAt: string
}
