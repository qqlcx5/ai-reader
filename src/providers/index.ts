/**
 * ai-reader Provider & LLM Client — Unified Export
 *
 * Provides:
 * - BaseProvider abstract class & factory
 * - All provider implementations (OpenAI, Anthropic, Gemini, Custom)
 * - SSE streaming utilities & retry logic
 * - Metrics/cost tracking
 * - Quote deduplication
 * - Global abort registry
 */

// ─── Core ──────────────────────────────────────────────────────────────

export { BaseProvider } from './base';
export { createProvider, getSupportedProviderTypes, getDefaultModel } from './factory';

// ─── Providers ─────────────────────────────────────────────────────────

export { OpenAIProvider } from './providers/openai';
export { AnthropicProvider } from './providers/anthropic';
export { GeminiProvider } from './providers/gemini';
export { CustomOpenAIProvider } from './providers/custom';

// ─── Utilities ─────────────────────────────────────────────────────────

export { fetchSSE } from './fetch-sse';
export type { FetchSSEOptions } from './fetch-sse';

export { fetchWithRetry, DEFAULT_RETRY_POLICY } from './retry';
export type { RetryPolicy } from './retry';

export {
  createMetrics,
  updateMetricsOnEvent,
  estimateCost,
  roughTokenCount,
} from './metrics';

export { QuoteProcessor, DEFAULT_QUOTE_OPTIONS } from './quote-processor';
export type { QuoteProcessorOptions } from './quote-processor';

export {
  registerAbortController,
  unregisterAbortController,
  abortAllRequests,
  getActiveRequestCount,
  createRegisteredAbortController,
} from './abort-registry';

// ─── Types ────────────────────────────────────────────────────────────

export type {
  ProviderType,
  ProviderConfig,
  ChatMessage,
  ChatRequest,
  StreamEvent,
  RequestMetrics,
} from './types';

export {
  ProviderError,
  MISSING_API_KEY,
  MISSING_BASE_URL,
  MISSING_MODEL,
  NETWORK_ERROR,
  RATE_LIMIT,
  SERVER_ERROR,
  PARSE_ERROR,
  ABORTED,
  TIMEOUT,
  UNKNOWN_PROVIDER,
} from './types';
