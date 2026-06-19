import type { LLMProvider, ProviderConfig, StreamRequest } from './types';
import { readSSEStream } from './sse';
import { toStreamError, toNetworkError } from '@/utils/errors';

export const geminiProvider: LLMProvider = {
  id: 'gemini',
  name: 'Gemini',
  async stream(config: ProviderConfig, req: StreamRequest) {
    const url = `${config.baseUrl}/v1beta/models/${config.model}:streamGenerateContent?alt=sse&key=${config.apiKey}`;
    let resp: Response;
    try {
      resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: req.prompt }] }],
          generationConfig: { maxOutputTokens: 4096 },
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
        const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) req.onDelta(text);
      }
      req.onDone();
    } catch (e) {
      if (req.signal.aborted) return;
      req.onError(toNetworkError(e instanceof Error ? e : new Error(String(e))));
    }
  },
};
