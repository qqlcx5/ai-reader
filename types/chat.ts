export interface ChatMessage {
  id: string

  role: 'user' | 'assistant' | 'system'
  content: string

  /** Thinking / reasoning content from models that support it (DeepSeek R1, OpenAI o1, etc.) */
  reasoningContent?: string

  modelId?: string
  /** Internal ModelConfig.id (UUID) for unambiguous name lookup.
   *  Falls back to modelId when absent (legacy messages). */
  modelConfigId?: string

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
  /** Time to first token (send → first token), ms. */
  firstTokenMs?: number
  /** Token generation time (first token → done), ms. */
  genMs?: number
}

export interface SteeringMessage {
  id: string
  content: string
  modelConfigIds: string[]
  createdAt: string
  error?: string
}

export interface ConversationEntity {
  id: string

  documentId: string

  title?: string
  messages: ChatMessage[]
  /** Messages entered while another response was generating. */
  steeringQueue?: SteeringMessage[]
  /** The conversation this path was branched from, when applicable. */
  parentConversationId?: string
  /** Message boundary used to create this path. */
  branchedAtMessageId?: string

  createdAt: string
  updatedAt: string
}
