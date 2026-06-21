/**
 * Gemini Provider
 *
 * Supports: Google Gemini API (streamGenerateContent) with SSE
 *   POST {baseUrl}/models/{model}:streamGenerateContent?alt=sse&key={apiKey}
 *   SSE: data: {"candidates":[{"content":{"parts":[{"text":"..."}]}}]}
 *
 * API key is passed as query parameter (not Authorization header).
 */

import { BaseProvider } from '../base';
import type { ChatRequest, StreamEvent } from '../types';

const SAFETY_SETTINGS = [
  { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'OFF' },
  { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'OFF' },
  { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'OFF' },
  { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'OFF' },
] as const;

export class GeminiProvider extends BaseProvider {
  protected defaultBaseUrl(): string {
    return 'https://generativelanguage.googleapis.com/v1beta';
  }

  protected buildUrl(): string {
    const apiKey = this.config.apiKey || '';
    const model = this.config.model;
    return `${this.baseUrl}/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;
  }

  protected buildHeaders(_apiKey: string): Record<string, string> {
    // Gemini uses API key as query param, not in headers
    return {
      'Content-Type': 'application/json',
      ...this.config.headers,
    };
  }

  protected buildBody(request: ChatRequest): unknown {
    const systemInstruction = request.systemPrompt
      ? { parts: [{ text: request.systemPrompt }] }
      : undefined;

    const contents = request.messages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const body: Record<string, unknown> = {
      contents,
      safetySettings: SAFETY_SETTINGS,
      generationConfig: {
        ...this.config.parameters,
        ...request.parameters,
      },
    };

    if (systemInstruction) {
      body.systemInstruction = systemInstruction;
    }

    return body;
  }

  protected parseStreamChunk(
    data: string,
    controller: { emit: (e: StreamEvent) => void },
  ): void {
    try {
      const json = JSON.parse(data);
      const candidates = json.candidates;

      if (!candidates || candidates.length === 0) return;

      for (const candidate of candidates) {
        // Content delta
        const parts = candidate.content?.parts || [];
        for (const part of parts) {
          if (part.text) {
            controller.emit({ type: 'delta', content: part.text });
          }
        }

        // Finish reason
        if (candidate.finishReason && candidate.finishReason !== 'STOP') {
          controller.emit({ type: 'done', finishReason: candidate.finishReason });
        }
      }

      // Usage metadata
      if (json.usageMetadata) {
        controller.emit({
          type: 'usage',
          promptTokens: json.usageMetadata.promptTokenCount ?? 0,
          completionTokens: json.usageMetadata.candidatesTokenCount ?? 0,
        });
      }
    } catch {
      // Malformed chunk — skip
    }
  }
}
