import type { ModelConfig } from '@/types/model'

export interface ChatOutput {
  content: string
  usage?: {
    promptTokens?: number
    completionTokens?: number
    totalTokens?: number
  }
}

export interface TestConnectionResult {
  success: boolean
  latency: number
  error?: string
}

export interface ChatInput {
  model: ModelConfig
  systemPrompt?: string
  context?: string
  messages: {
    role: 'user' | 'assistant' | 'system'
    content: string
  }[]
  signal?: AbortSignal
}

export interface StreamCallbacks {
  onToken: (text: string) => void
  onReasoning?: (text: string) => void
  /** Real token usage parsed from the stream tail (when the provider returns it). */
  onUsage?: (usage: NonNullable<ChatOutput['usage']>) => void
  onDone: () => void
  onError: (error: Error) => void
}

export interface AIProvider {
  chat(input: ChatInput): Promise<ChatOutput>
  streamChat(input: ChatInput, callbacks: StreamCallbacks): Promise<void>
  testConnection(config: ModelConfig): Promise<TestConnectionResult>
}
