import type { LLMProvider, ProviderConfig, StreamRequest } from './types';
import { readSSEStream } from './sse';

// Ollama uses OpenAI-compatible API
export const ollamaProvider: LLMProvider = {
  id: 'ollama',
  name: 'Ollama',
  async stream(config: ProviderConfig, req: StreamRequest) {
    const baseUrl = config.baseUrl || 'http://localhost:11434';
    const resp = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: 'user', content: req.prompt }],
        stream: true,
      }),
      signal: req.signal,
    });

    if (!resp.ok) {
      const err = await resp.text();
      req.onError(`Ollama error ${resp.status}: ${err}`);
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
      req.onError(e instanceof Error ? e.message : 'Stream error');
    }
  },
};
