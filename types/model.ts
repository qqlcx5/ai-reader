export interface ThinkingConfig {
  enabled: boolean
  /** Thinking token budget. Anthropic requires this > 0 when enabled. */
  budgetTokens?: number
}

export interface ModelConfig {
  id: string
  name: string

  provider: 'openai-compatible' | 'anthropic' | 'ollama'
  modelId: string

  baseUrl?: string
  apiKey?: string

  enabled: boolean
  isDefault: boolean

  /** Model input context window (tokens). Used locally for truncation math; never sent to the API. */
  contextWindow?: number

  /** Sampling temperature. Only sent when set. */
  temperature?: number

  /** Max output tokens. Only sent when set. */
  maxTokens?: number

  /** Extended thinking (Anthropic-style). Only sent when enabled. */
  thinking?: ThinkingConfig

  /** OpenAI-style reasoning effort (e.g. minimal/low/medium/high/xhigh). Only sent when set. */
  reasoningEffort?: string

  /** Per-model max retry count for failed AI calls (0 = no retry). Default 2. */
  maxRetries?: number

  /** Per-1M-tokens input price (CNY). Overrides the built-in pricing table when set. */
  inputPricePer1M?: number
  /** Per-1M-tokens output price (CNY). Overrides the built-in pricing table when set. */
  outputPricePer1M?: number

  systemPrompt?: string

  createdAt: string
  updatedAt: string

  lastUsedAt?: string

  lastTestStatus?: 'untested' | 'testing' | 'success' | 'failed'
  lastTestLatency?: number
  lastTestError?: string
}
