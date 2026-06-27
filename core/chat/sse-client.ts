// ============================================================
// SSE Streaming Client — OpenAI-compatible chat/stream endpoint
// Uses eventsource-parser + fetch ReadableStream (MV3 compatible)
// ============================================================

import { createParser, type ParsedEvent, type ReconnectInterval } from 'eventsource-parser';

export interface StreamChatConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  messages: Array<{ role: string; content: string }>;
  signal?: AbortSignal;
  maxRetries?: number;
  temperature?: number;
  maxTokens?: number;
}

export interface StreamError {
  type: 'network' | 'api' | 'aborted' | 'parse' | 'max_retries';
  message: string;
  statusCode?: number;
}

/**
 * Stream a chat completion from an OpenAI-compatible API.
 * Returns an AsyncGenerator that yields content deltas as they arrive.
 */
export async function* streamChatCompletion(
  config: StreamChatConfig,
): AsyncGenerator<string, void, undefined> {
  const maxRetries = config.maxRetries ?? 3;
  let lastError: StreamError | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const controller = new AbortController();

      // Wire external abort signal to internal controller
      const onExternalAbort = () => controller.abort();
      config.signal?.addEventListener('abort', onExternalAbort, { once: true });

      const response = await fetch(`${config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
          Accept: 'text/event-stream',
        },
        body: JSON.stringify({
          model: config.model,
          messages: config.messages,
          stream: true,
          temperature: config.temperature ?? 0.7,
          max_tokens: config.maxTokens ?? 4096,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        throw {
          type: response.status === 429 || response.status >= 500 ? 'network' : 'api',
          message: `API ${response.status}: ${errorBody.slice(0, 200)}`,
          statusCode: response.status,
        } as StreamError;
      }

      if (!response.body) {
        throw {
          type: 'network',
          message: 'Response body is null',
        } as StreamError;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      const parser = createParser((event: ParsedEvent | ReconnectInterval) => {
        if (event.type === 'event' && event.data && event.data !== '[DONE]') {
          buffer += event.data;
        }
      });

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          buffer += chunk;

          // Process complete lines from buffer
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6).trim();
              if (data === '[DONE]') {
                // Flush remaining buffer
                const lastContent = parseContentFromBuffer(buffer);
                if (lastContent) yield lastContent;
                return;
              }
              try {
                const parsed = JSON.parse(data);
                const content = parsed?.choices?.[0]?.delta?.content;
                if (content) yield content;
              } catch {
                // Skip unparseable lines
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
        config.signal?.removeEventListener('abort', onExternalAbort);
      }

      // Success — exit retry loop
      return;
    } catch (err: any) {
      const streamErr: StreamError =
        err?.type ? err
        : err?.name === 'AbortError'
          ? { type: 'aborted', message: 'Request aborted' }
          : { type: 'network', message: err.message || 'Unknown network error' };

      if (streamErr.type === 'aborted') {
        throw streamErr;
      }

      lastError = streamErr;

      // Don't retry on 4xx (client errors) except 429
      if (streamErr.statusCode && streamErr.statusCode >= 400 && streamErr.statusCode < 500 && streamErr.statusCode !== 429) {
        throw streamErr;
      }

      // Exponential backoff before retry
      if (attempt < maxRetries - 1) {
        await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000));
      }
    }
  }

  // All retries exhausted
  throw lastError || { type: 'max_retries', message: 'Max retries exhausted' } as StreamError;
}

/**
 * Parse any remaining content from the buffer after [DONE] or stream end.
 */
function parseContentFromBuffer(buffer: string): string | null {
  const lines = buffer.split('\n');
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const data = line.slice(6).trim();
      if (data === '[DONE]') continue;
      try {
        const parsed = JSON.parse(data);
        return parsed?.choices?.[0]?.delta?.content ?? null;
      } catch {
        // skip
      }
    }
  }
  return null;
}
