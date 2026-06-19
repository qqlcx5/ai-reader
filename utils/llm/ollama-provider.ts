import type { LLMProvider, ProviderConfig, StreamRequest } from './types';
import { readSSEStream } from './sse';
import { toStreamError, toNetworkError } from '@/utils/errors';

// Ollama uses OpenAI-compatible API
export const ollamaProvider: LLMProvider = {
  id: 'ollama',
  name: 'Ollama',
  async stream(config: ProviderConfig, req: StreamRequest) {
    const baseUrl = config.baseUrl || 'http://localhost:11434';
    let resp: Response;
    try {
      resp = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: config.model,
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

    try {
      for await (const data of readSSEStream(resp)) {
        const parsed = JSON.parse(data);
        const delta = parsed.choices?.[0]?.delta?.content;
        if (delta) req.onDelta(delta);
      }
      req.onDone();
    } catch (e) {
      if (req.signal.aborted) return;
      req.onError(toNetworkError(e instanceof Error ? e : new Error(String(e))));
    }
  },
};
