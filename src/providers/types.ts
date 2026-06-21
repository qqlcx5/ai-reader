/**
 * Provider & LLM Client — Types
 *
 * Defines all data structures for Provider abstraction, SSE streaming events,
 * request/response types, and error codes. Based on design-03-provider-client.md.
 */

// ─── Provider Configuration ────────────────────────────────────────────

export type ProviderType = 'openai' | 'anthropic' | 'gemini' | 'custom';

export interface ProviderConfig {
  id: string;
  name: string;
  type: ProviderType;
  /** User-defined API Base URL; falls back to official default when empty */
  baseUrl?: string;
  /** User-defined model name */
  model: string;
  /** API Key (read from storage at runtime) */
  apiKey?: string;
  /** Enabled flag */
  enabled: boolean;
  /** Extra request headers */
  headers?: Record<string, string>;
  /** Parameter overrides (temperature, top_p, etc.) */
  parameters?: Record<string, unknown>;
}

// ─── Chat Messages ────────────────────────────────────────────────────

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  providerId: string;
  /** System prompt for this request */
  systemPrompt?: string;
  /** History messages + current user message */
  messages: ChatMessage[];
  /** Parameter overrides */
  parameters?: Record<string, unknown>;
  /** Abort signal for cancellation */
  signal?: AbortSignal;
}

// ─── Stream Events ────────────────────────────────────────────────────

/**
 * Unified stream event that all providers emit during SSE streaming.
 * Consumers (workspace UI) listen to these events to render responses.
 */
export type StreamEvent =
  | { type: 'start'; timestamp: number }
  | { type: 'delta'; content: string }
  | { type: 'usage'; promptTokens: number; completionTokens: number }
  | { type: 'error'; code: string; message: string }
  | { type: 'done'; finishReason: string };

// ─── Metrics ───────────────────────────────────────────────────────────

export interface RequestMetrics {
  providerId: string;
  model: string;
  startTime: number;
  firstTokenTime: number | null; // TTFT (Time To First Token)
  endTime: number | null;
  totalLatency: number | null;
  tokensPerSecond: number | null;
  estimatedCost: number | null;
}

// ─── Error Codes ──────────────────────────────────────────────────────

export const MISSING_API_KEY = 'MISSING_API_KEY';
export const MISSING_BASE_URL = 'MISSING_BASE_URL';
export const MISSING_MODEL = 'MISSING_MODEL';
export const NETWORK_ERROR = 'NETWORK_ERROR';
export const RATE_LIMIT = 'RATE_LIMIT';
export const SERVER_ERROR = 'SERVER_ERROR';
export const PARSE_ERROR = 'PARSE_ERROR';
export const ABORTED = 'ABORTED';
export const TIMEOUT = 'TIMEOUT';
export const UNKNOWN_PROVIDER = 'UNKNOWN_PROVIDER';

export class ProviderError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode?: number,
    public retryable: boolean = false,
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}
