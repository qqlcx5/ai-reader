/**
 * M3 Provider & LLM Client — OpenAI Provider
 */
import { BaseProvider } from '../base';
import type { ChatRequest, StreamEvent, RequestMetrics, ChatMessage } from '../types';
import { ProviderError, PARSE_ERROR } from '../types';
import { createParser } from 'eventsource-parser';
import type { EventSourceMessage as ParsedEvent } from 'eventsource-parser';
import { fetchWithRetry, DEFAULT_RETRY_POLICY } from '../retry';
import { createMetrics, updateMetricsOnEvent } from '../metrics';

export class OpenAIProvider extends BaseProvider {
  protected defaultBaseUrl(): string {
    return 'https://api.openai.com/v1';
  }

  protected buildHeaders(apiKey: string): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      ...this.config.headers,
    };
  }

  protected buildBody(request: ChatRequest): unknown {
    const messages: ChatMessage[] = [];
    if (request.systemPrompt) {
      messages.push({ role: 'system', content: request.systemPrompt });
    }
    messages.push(...request.messages);

    return {
      model: this.config.model,
      messages,
      stream: true,
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
      const delta = data.choices?.[0]?.delta;
      if (delta?.content) {
        controller.emit({ type: 'delta', content: delta.content });
      }
      if (data.usage) {
        controller.emit({
          type: 'usage',
          promptTokens: data.usage.prompt_tokens || 0,
          completionTokens: data.usage.completion_tokens || 0,
        });
      }
      if (data.choices?.[0]?.finish_reason) {
        controller.emit({ type: 'done', finishReason: data.choices[0].finish_reason });
      }
    } catch {
      // Malformed chunk, ignore and continue
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
        fetch(`${this.baseUrl}/chat/completions`, {
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
          if (event.data === '[DONE]') {
            onEvent({ type: 'done', finishReason: 'stop' });
            updateMetricsOnEvent(metrics, { type: 'done', finishReason: 'stop' });
            return;
          }
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

    return metrics;
  }
}
