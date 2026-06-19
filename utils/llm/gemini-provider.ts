import type { LLMProvider, ProviderConfig, StreamRequest } from './types';
import { readSSEStream } from './sse';

export const geminiProvider: LLMProvider = {
  id: 'gemini',
  name: 'Gemini',
  async stream(config: ProviderConfig, req: StreamRequest) {
    const url = `${config.baseUrl}/v1beta/models/${config.model}:streamGenerateContent?alt=sse&key=${config.apiKey}`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: req.prompt }] }],
        generationConfig: { maxOutputTokens: 4096 },
      }),
      signal: req.signal,
    });

    if (!resp.ok) {
      const err = await resp.text();
      req.onError(`Gemini error ${resp.status}: ${err}`);
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
      req.onError(e instanceof Error ? e.message : 'Stream error');
    }
  },
};
