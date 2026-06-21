/**
 * Anthropic Provider
 *
 * Supports: Anthropic Messages API (streaming)
 *   POST {baseUrl}/messages
 *   SSE: event: content_block_delta / message_delta / message_stop
 *
 * Uses x-api-key header (not Bearer token).
 */

import { BaseProvider } from '../base';
import type { ChatRequest, StreamEvent, ChatMessage } from '../types';

export class AnthropicProvider extends BaseProvider {
  protected defaultBaseUrl(): string {
    return 'https://api.anthropic.com/v1';
  }

  protected buildUrl(): string {
    return `${this.baseUrl}/messages`;
  }

  protected buildHeaders(apiKey: string): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      ...this.config.headers,
    };
  }

  protected buildBody(request: ChatRequest): unknown {
    // Anthropic separates system from messages
    const system = request.systemPrompt || undefined;

    const messages = request.messages.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    const body: Record<string, unknown> = {
      model: this.config.model,
      messages,
      stream: true,
      max_tokens: 4096,
    };

    if (system) {
      body.system = system;
    }

    // Allow overrides from config and request
    Object.assign(body, this.config.parameters, request.parameters);

    return body;
  }

  protected parseStreamChunk(
    data: string,
    controller: { emit: (e: StreamEvent) => void },
  ): void {
    try {
      const json = JSON.parse(data);
      const { type } = json;

      switch (type) {
        case 'content_block_start':
        case 'content_block_delta': {
          const delta = json.delta;
          if (delta?.type === 'text_delta' && delta.text) {
            controller.emit({ type: 'delta', content: delta.text });
          }
          break;
        }

        case 'message_delta': {
          if (json.usage) {
            controller.emit({
              type: 'usage',
              promptTokens: json.usage.input_tokens ?? 0,
              completionTokens: json.usage.output_tokens ?? 0,
            });
          }
          break;
        }

        case 'message_stop': {
          controller.emit({ type: 'done', finishReason: 'stop' });
          break;
        }

        case 'error': {
          controller.emit({
            type: 'error',
            code: 'ANTHROPIC_ERROR',
            message: json.error?.message ?? 'Unknown Anthropic error',
          });
          break;
        }
      }
    } catch {
      // Malformed chunk — skip
    }
  }
}
