/**
 * M3 Provider & LLM Client — Gemini Provider
 * Uses Gemini streaming generateContent API
 */
import { BaseProvider } from '../base';
import type { ChatRequest, StreamEvent, RequestMetrics, ChatMessage } from '../types';
import { ProviderError } from '../types';
import { fetchWithRetry, DEFAULT_RETRY_POLICY } from '../retry';
import { createMetrics, updateMetricsOnEvent } from '../metrics';

export class GeminiProvider extends BaseProvider {
  protected defaultBaseUrl(): string {
    return 'https://generativelanguage.googleapis.com/v1beta';
  }

  protected buildHeaders(_apiKey: string): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      ...this.config.headers,
    };
  }

  protected buildBody(request: ChatRequest): unknown {
    const contents = request.messages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        ...this.config.parameters,
        ...request.parameters,
      },
    };

    if (request.systemPrompt) {
      body.systemInstruction = { parts: [{ text: request.systemPrompt }] };
    }

    return body;
  }

  protected parseStreamChunk(
    chunk: string,
    controller: { emit: (e: StreamEvent) => void }
  ): void {
    try {
      const data = JSON.parse(chunk);
      const candidates = data.candidates || [];
      for (const candidate of candidates) {
        const parts = candidate.content?.parts || [];
        for (const part of parts) {
          if (part.text) {
            controller.emit({ type: 'delta', content: part.text });
          }
        }
        if (candidate.finishReason && candidate.finishReason !== 'STOP') {
          controller.emit({ type: 'done', finishReason: candidate.finishReason });
        }
      }
      if (data.usageMetadata) {
        controller.emit({
          type: 'usage',
          promptTokens: data.usageMetadata.promptTokenCount || 0,
          completionTokens: data.usageMetadata.candidatesTokenCount || 0,
        });
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

    const modelName = this.config.model;
    const url = `${this.baseUrl}/models/${modelName}:streamGenerateContent?alt=sse&key=${apiKey}`;

    const response = await fetchWithRetry(
      () =>
        fetch(url, {
          method: 'POST',
          headers: this.buildHeaders(apiKey),
          body: JSON.stringify(this.buildBody(request)),
          signal: request.signal,
        }),
      { ...DEFAULT_RETRY_POLICY, signal: request.signal }
    );

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        if (request.signal?.aborted) {
          throw new ProviderError('ABORTED', 'Request was aborted');
        }
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;
          const data = trimmed.slice(6);
          if (data === '[DONE]') {
            onEvent({ type: 'done', finishReason: 'stop' });
            updateMetricsOnEvent(metrics, { type: 'done', finishReason: 'stop' });
            continue;
          }
          this.parseStreamChunk(data, {
            emit: (e) => {
              onEvent(e);
              updateMetricsOnEvent(metrics, e);
            },
          });
        }
      }

      // Process remaining buffer
      if (buffer.trim()) {
        const trimmed = buffer.trim();
        if (trimmed.startsWith('data: ')) {
          this.parseStreamChunk(trimmed.slice(6), {
            emit: (e) => {
              onEvent(e);
              updateMetricsOnEvent(metrics, e);
            },
          });
        }
      }
    } finally {
      reader.releaseLock();
      if (!metrics.endTime) {
        metrics.endTime = Date.now();
        metrics.totalLatency = metrics.endTime - metrics.startTime;
      }
    }

    // Ensure done event
    if (!metrics.endTime) {
      onEvent({ type: 'done', finishReason: 'stop' });
      updateMetricsOnEvent(metrics, { type: 'done', finishReason: 'stop' });
    }

    return metrics;
  }
}
