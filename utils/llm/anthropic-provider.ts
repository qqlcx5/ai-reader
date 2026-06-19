import type { LLMProvider, ProviderConfig, StreamRequest } from './types';
import { toStreamError, toNetworkError } from '@/utils/errors';

export const anthropicProvider: LLMProvider = {
  id: 'anthropic',
  name: 'Anthropic',
  async stream(config: ProviderConfig, req: StreamRequest) {
    let resp: Response;
    try {
      resp = await fetch(`${config.baseUrl}/v1/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': config.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: config.model,
          max_tokens: config.maxTokens || 4096,
          messages: [{ role: 'user', content: req.prompt }],
          stream: true,
        }),
        signal: req.signal,
      });
    } catch (e) {
      if (req.signal.aborted) return;
      req.onError(toNetworkError(e instanceof Error ? e : new Error(String(e))));
      return;
    }

    if (!resp.ok) {
      const body = await resp.text();
      const err = toStreamError(resp.status, body);
      if (resp.status === 429) {
        const retryAfter = resp.headers.get('Retry-After');
        if (retryAfter) err.retryAfter = Number(retryAfter);
      }
      req.onError(err);
      return;
    }

    const reader = resp.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data: ')) {
            const data = JSON.parse(trimmed.slice(6));
            if (data.type === 'content_block_delta') {
              req.onDelta(data.delta?.text || '');
            } else if (data.type === 'message_stop') {
              req.onDone();
              return;
            }
          }
        }
      }
      req.onDone();
    } catch (e) {
      if (req.signal.aborted) return;
      req.onError(toNetworkError(e instanceof Error ? e : new Error(String(e))));
    } finally {
      reader.releaseLock();
    }
  },
};
