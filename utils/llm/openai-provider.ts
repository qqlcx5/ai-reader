import type { LLMProvider, ProviderConfig, StreamRequest } from './types';
import { readSSEStream } from './sse';

export const openaiProvider: LLMProvider = {
  id: 'openai',
  name: 'OpenAI',
  async stream(config: ProviderConfig, req: StreamRequest) {
    const resp = await fetch(`${config.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: 'user', content: req.prompt }],
        stream: true,
      }),
      signal: req.signal,
    });

    if (!resp.ok) {
      const err = await resp.text();
      req.onError(`OpenAI error ${resp.status}: ${err}`);
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
