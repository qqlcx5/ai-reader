/**
 * BaseProvider — Abstract Provider class
 *
 * All LLM provider implementations extend this class.  It defines the
 * contract for:
 *  - Building provider-specific headers and request bodies
 *  - Parsing SSE stream chunks into unified StreamEvents
 *  - Orchestrating the full streaming chat lifecycle via fetchSSE
 *
 * Based on design-03-provider-client.md §4 and nextai-translator's
 * AbstractEngine / AbstractOpenAI architecture.
 */

import type {
  ProviderConfig,
  ChatRequest,
  ChatMessage,
  StreamEvent,
  RequestMetrics,
} from './types';
import { ProviderError, MISSING_API_KEY } from './types';
import { fetchSSE } from './fetch-sse';
import { fetchWithRetry, DEFAULT_RETRY_POLICY } from './retry';
import { createMetrics, updateMetricsOnEvent } from './metrics';

export abstract class BaseProvider {
  constructor(public config: ProviderConfig) {}

  // ─── Public API ───────────────────────────────────────────────────

  /**
   * Execute a streaming chat completion request.
   *
   * Lifecycle:
   * 1. Validates API key
   * 2. Creates metrics tracker
   * 3. Emits 'start' event
   * 4. Calls fetchWithRetry → fetchSSE for streaming
   * 5. Parses each SSE chunk via parseStreamChunk()
   * 6. Emits 'delta' / 'usage' / 'done' / 'error' events
   * 7. Returns RequestMetrics
   */
  async chatStream(
    request: ChatRequest,
    onEvent: (event: StreamEvent) => void,
  ): Promise<RequestMetrics> {
    const apiKey = this.validateApiKey();
    const metrics = createMetrics(this.config.id, this.config.model);
    const signal = request.signal;

    onEvent({ type: 'start', timestamp: metrics.startTime });

    // Build request URL and body
    const url = this.buildUrl();
    const headers = this.buildHeaders(apiKey);
    const body = this.buildBody(request);

    // Execute with retry, then stream
    const response = await fetchWithRetry(
      () =>
        fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
          signal,
        }),
      { ...DEFAULT_RETRY_POLICY },
      signal,
    );

    // Handle non-streaming (JSON) response fallback
    const contentType = response.headers.get('content-type') || '';
    if (
      !contentType.includes('text/event-stream') &&
      (contentType.includes('application/json') || contentType.includes('text/plain'))
    ) {
      await this.handleNonStreamingResponse(response, onEvent, metrics);
      return metrics;
    }

    await fetchSSE(response.url, {
      // For SSE, we already have the response; pass a no-op fetcher
      // and feed the body directly. We override the fetch approach:
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal,
      fetcher: async () => response,
      onStatusCode: () => {},
      onMessage: async (data: string) => {
        if (data === '[DONE]') return;
        this.parseStreamChunk(data, {
          emit: (e) => {
            onEvent(e);
            updateMetricsOnEvent(metrics, e);
          },
        });
      },
      onError: (err) => {
        const message = err instanceof Error ? err.message : String(err);
        onEvent({ type: 'error', code: 'SSE_ERROR', message });
      },
    });

    // Ensure done if not emitted by stream
    if (!metrics.endTime) {
      metrics.endTime = Date.now();
      metrics.totalLatency = metrics.endTime - metrics.startTime;
      onEvent({ type: 'done', finishReason: 'stop' });
      updateMetricsOnEvent(metrics, { type: 'done', finishReason: 'stop' });
    }

    return metrics;
  }

  // ─── Subclass Contract ────────────────────────────────────────────

  /** Official default API base URL (e.g. https://api.openai.com/v1). */
  protected abstract defaultBaseUrl(): string;

  /** Build HTTP headers including auth. */
  protected abstract buildHeaders(apiKey: string): Record<string, string>;

  /** Build the JSON request body for the provider's API. */
  protected abstract buildBody(request: ChatRequest): unknown;

  /**
   * Parse one SSE data line string into StreamEvent(s).
   * Called for each non-[DONE] SSE event.
   */
  protected abstract parseStreamChunk(
    data: string,
    controller: { emit: (e: StreamEvent) => void },
  ): void;

  // ─── Helpers ──────────────────────────────────────────────────────

  protected get baseUrl(): string {
    return this.config.baseUrl || this.defaultBaseUrl();
  }

  /** Build full API endpoint URL. Override for non-standard paths. */
  protected buildUrl(): string {
    return this.baseUrl;
  }

  /** Validate and return API key. */
  protected validateApiKey(): string {
    const key = this.config.apiKey?.trim();
    if (!key) {
      throw new ProviderError(
        MISSING_API_KEY,
        `API Key is not configured for provider "${this.config.name}"`,
      );
    }
    return key;
  }

  /**
   * Fallback: parse a non-streaming JSON response.
   * Subclasses can override for provider-specific JSON shapes.
   */
  protected async handleNonStreamingResponse(
    response: Response,
    onEvent: (event: StreamEvent) => void,
    metrics: RequestMetrics,
  ): Promise<void> {
    try {
      const text = await response.text();
      const data = JSON.parse(text);

      // Try OpenAI-style response shape
      const content =
        data.choices?.[0]?.message?.content ||
        data.choices?.[0]?.text ||
        data.content?.[0]?.text ||
        '';

      if (content) {
        onEvent({ type: 'delta', content });
        updateMetricsOnEvent(metrics, { type: 'delta', content });
      }

      const finishReason =
        data.choices?.[0]?.finish_reason ||
        (data.candidates?.[0]?.finishReason === 'STOP' ? 'stop' : data.candidates?.[0]?.finishReason) ||
        'stop';

      onEvent({ type: 'done', finishReason });
      updateMetricsOnEvent(metrics, { type: 'done', finishReason });

      metrics.endTime = Date.now();
      metrics.totalLatency = metrics.endTime - metrics.startTime;
    } catch (err) {
      onEvent({
        type: 'error',
        code: 'PARSE_ERROR',
        message: 'Failed to parse non-streaming response',
      });
    }
  }
}
