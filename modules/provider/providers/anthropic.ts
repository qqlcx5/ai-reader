/**
 * M3 Provider & LLM Client — Anthropic Provider
 */
import { BaseProvider } from '../base';
import type { ChatRequest, StreamEvent, RequestMetrics, ChatMessage } from '../types';
import { ProviderError } from '../types';
import { createParser } from 'eventsource-parser';
import type { EventSourceMessage as ParsedEvent } from 'eventsource-parser';
import { fetchWithRetry, DEFAULT_RETRY_POLICY } from '../retry';
import { createMetrics, updateMetricsOnEvent } from '../metrics';

export class AnthropicProvider extends BaseProvider {
  protected defaultBaseUrl(): string {
    return 'https://api.anthropic.com/v1';
  }

  protected buildHeaders(apiKey: string): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      ...this.config.headers,
    };
  }

  protected buildBody(request: ChatRequest): unknown {
    const system = request.systemPrompt || undefined;
    const messages = request.messages.map((m) => ({
      role: m.role === 'system' ? 'user' : m.role,
      content: m.content,
    }));

    return {
      model: this.config.model,
      messages,
      system,
      stream: true,
      max_tokens: 4096,
      ...this.config.parameters,
      ...request.parameters,
    };
  }

  protected parseStreamChunk(
    chunk: string,
    controller: { emit: (e: StreamEvent) => void }
  ): void {
    try {
      const data = JSON.parse(chunk);
      if (data.type === 'content_block_delta' && data.delta?.text) {
        controller.emit({ type: 'delta', content: data.delta.text });
      }
      if (data.type === 'message_delta' && data.usage) {
        controller.emit({
          type: 'usage',
          promptTokens: data.usage.input_tokens || 0,
          completionTokens: data.usage.output_tokens || 0,
        });
      }
      if (data.type === 'message_stop') {
        controller.emit({ type: 'done', finishReason: 'stop' });
      }
    } catch {
      // Ignore malformed chunks
    }
  }

  async chatStream(
    request: ChatRequest,
    onEvent: (event: StreamEvent) => void
  ): Promise<RequestMetrics> {
    const apiKey = this.validateApiKey();
    const metrics = createMetrics(this.config.id, this.config.model);

    onEvent({ type: 'start', timestamp: metrics.startTime });

    const response = await fetchWithRetry(
      () =>
        fetch(`${this.baseUrl}/messages`, {
          method: 'POST',
          headers: this.buildHeaders(apiKey),
          body: JSON.stringify(this.buildBody(request)),
          signal: request.signal,
        }),
      { ...DEFAULT_RETRY_POLICY, signal: request.signal }
    );

    const parser = createParser({
      onEvent: (event: ParsedEvent) => {
        if (event.event || event.data) {
          this.parseStreamChunk(event.data, {
            emit: (e) => {
              onEvent(e);
              updateMetricsOnEvent(metrics, e);
            },
          });
        }
      },
    });

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        if (request.signal?.aborted) {
          throw new ProviderError('ABORTED', 'Request was aborted');
        }
        const { done, value } = await reader.read();
        if (done) break;
        parser.feed(decoder.decode(value, { stream: true }));
      }
    } finally {
      reader.releaseLock();
      if (!metrics.endTime) {
        metrics.endTime = Date.now();
        metrics.totalLatency = metrics.endTime - metrics.startTime;
      }
    }

    // Ensure done event if not already emitted
    onEvent({ type: 'done', finishReason: 'stop' });
    updateMetricsOnEvent(metrics, { type: 'done', finishReason: 'stop' });

    return metrics;
  }
}
