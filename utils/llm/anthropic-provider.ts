import type { LLMProvider, ProviderConfig, StreamRequest } from './types';

export const anthropicProvider: LLMProvider = {
  id: 'anthropic',
  name: 'Anthropic',
  async stream(config: ProviderConfig, req: StreamRequest) {
    const resp = await fetch(`${config.baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: 4096,
        messages: [{ role: 'user', content: req.prompt }],
        stream: true,
      }),
      signal: req.signal,
    });

    if (!resp.ok) {
      const err = await resp.text();
      req.onError(`Anthropic error ${resp.status}: ${err}`);
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
      req.onError(e instanceof Error ? e.message : 'Stream error');
    } finally {
      reader.releaseLock();
    }
  },
};
