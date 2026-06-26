/**
 * Chat history types.
 *
 * `ChatHistory` is the persisted record (one per conversation
 * thread) and `ChatHistoryMessage` is a single turn within it. We
 * intentionally keep them separate from the streaming-protocol
 * `ChatMessage` used at runtime to avoid coupling.
 */

export interface ChatHistoryMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  createdAt: number
  /** Optional metadata captured at request time (model id, tokens). */
  model?: string
  tokens?: number
}

export interface ChatHistory {
  id: string
  documentId: string
  modelId: string
  model: string
  messages: ChatHistoryMessage[]
  createdAt: number
  updatedAt: number
}

/**
 * Runtime chat message used by the UI / streaming protocol.
 * Includes transient state (isStreaming, error) that we don't
 * persist directly.
 */
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  createdAt: number
  isStreaming?: boolean
  error?: string
  model?: string
  tokens?: number
}
