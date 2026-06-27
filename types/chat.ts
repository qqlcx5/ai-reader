export interface ChatMessage {
  id: string

  role: 'user' | 'assistant' | 'system'
  content: string

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
}

export interface ConversationEntity {
  id: string

  documentId: string

  title?: string
  messages: ChatMessage[]

  createdAt: string
  updatedAt: string
}
