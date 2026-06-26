/**
 * Adapter-layer type definitions.
 *
 * These types describe the contract between the OpenAI-compatible
 * adapter and its callers. They intentionally live in a separate
 * file from `db/types/model.ts` so we can evolve the streaming
 * protocol independently of the persisted record shape.
 */

/** A single message in a chat conversation. */
export interface Message {
  role: 'system' | 'user' | 'assistant'
  content: string
  /** Optional per-message name (rarely used). */
  name?: string
}

/** Options that control a single chat completion request. */
export interface ChatOptions {
  /** Override the model's default temperature. */
  temperature?: number
  /** Override max tokens. */
  maxTokens?: number
  /** Override the system prompt (otherwise uses the model's persisted one). */
  systemPrompt?: string
  /** Optional top-p. */
  topP?: number
  /** Request timeout in milliseconds (default 30s). */
  timeoutMs?: number
  /** Abort signal. */
  signal?: AbortSignal
  /** Request id for tracing (optional). */
  requestId?: string
}

/** Stream callback payload emitted by `chat()`. */
export interface StreamDelta {
  type: 'text' | 'reasoning' | 'done' | 'error'
  /** Text fragment for `text` / `reasoning`. */
  content?: string
  /** Error message for `error`. */
  error?: string
  /** Optional finish reason returned by the server. */
  finishReason?: string
}

/** Result of a chat completion. Returned by `chat()` after the stream ends. */
export interface ChatMessage {
  id: string
  role: 'assistant'
  content: string
  createdAt: number
  model?: string
  /** Finish reason (e.g. `stop`, `length`). */
  finishReason?: string
  /** Total tokens consumed, if reported by the server. */
  usage?: {
    promptTokens?: number
    completionTokens?: number
    totalTokens?: number
  }
}

/** Result of a connectivity check. */
export interface PingResult {
  ok: boolean
  /** Round-trip latency in milliseconds. */
  latency: number
  /** Human-readable error message when `ok` is false. */
  error?: string
  /** HTTP status code when available. */
  status?: number
}

/** Minimal subset of a model config the adapter actually needs. */
export interface ModelConfigInput {
  id: string
  name?: string
  baseUrl: string
  apiKey: string
  model: string
  systemPrompt?: string
  temperature?: number
  maxTokens?: number
}
