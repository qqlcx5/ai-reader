/**
 * OpenAI Provider
 *
 * Supports: OpenAI Chat Completions API (streaming)
 *   POST {baseUrl}/chat/completions
 *   SSE: data: {"choices":[{"delta":{"content":"..."}}]}
 *
 * Also compatible with any OpenAI-format proxy (e.g. LiteLLM, one-api).
 */

import { BaseProvider } from '../base';
import type { ChatRequest, StreamEvent, ChatMessage } from '../types';

export class OpenAIProvider extends BaseProvider {
  protected defaultBaseUrl(): string {
    return 'https://api.openai.com/v1';
  }

  protected buildUrl(): string {
    return `${this.baseUrl}/chat/completions`;
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
    data: string,
    controller: { emit: (e: StreamEvent) => void },
  ): void {
    try {
      const json = JSON.parse(data);
      const choice = json.choices?.[0];

      // Delta content
      if (choice?.delta?.content) {
        controller.emit({ type: 'delta', content: choice.delta.content });
      }

      // Usage info (some providers send per-chunk usage)
      if (json.usage) {
        controller.emit({
          type: 'usage',
          promptTokens: json.usage.prompt_tokens ?? 0,
          completionTokens: json.usage.completion_tokens ?? 0,
        });
      }

      // Finish reason
      if (choice?.finish_reason) {
        controller.emit({ type: 'done', finishReason: choice.finish_reason });
      }
    } catch {
      // Malformed chunk — skip silently
    }
  }
}
