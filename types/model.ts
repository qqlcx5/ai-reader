export interface ModelConfig {
  id: string
  name: string

  provider: 'openai-compatible' | 'anthropic' | 'ollama'
  modelId: string

  baseUrl?: string
  apiKey?: string

  enabled: boolean
  isDefault: boolean

  contextWindow: number
  temperature: number

  systemPrompt?: string

  createdAt: string
  updatedAt: string

  lastUsedAt?: string

  lastTestStatus?: 'untested' | 'testing' | 'success' | 'failed'
  lastTestLatency?: number
  lastTestError?: string
}
