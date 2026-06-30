export interface ChatMessage {
  id: string

  role: 'user' | 'assistant' | 'system'
  content: string

  /** Thinking / reasoning content from models that support it (DeepSeek R1, OpenAI o1, etc.) */
  reasoningContent?: string

  modelId?: string

  status?: 'pending' | 'sending' | 'streaming' | 'success' | 'failed' | 'aborted'

  createdAt: string
  updatedAt?: string

  error?: string

  tokenUsage?: {
    promptTokens?: number
    completionTokens?: number
    totalTokens?: number
  }

  /** Wall-clock generation time (send → done), ms. Set on completion/failure. */
  durationMs?: number
}

export interface ConversationEntity {
  id: string

  documentId: string

  title?: string
  messages: ChatMessage[]

  createdAt: string
  updatedAt: string
}
