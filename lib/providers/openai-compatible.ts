/**
 * M3 多模型 Provider 客户端 — OpenAI-Compatible 适配器基类
 *
 * 覆盖标准 OpenAI Chat Completions API 的所有细节。
 * 子类只需 override: id / name / defaultBaseUrl() 即可接入新 Provider。
 */

import { BaseEngine } from './base-engine';
import type { Message, ChatStreamOptions } from './types';
import { parse as bestEffortParse } from 'best-effort-json-parser';

export abstract class OpenAICompatibleEngine extends BaseEngine {
  readonly requiresApiKey: boolean = true;
  readonly isLocal: boolean = false;

  protected abstract defaultBaseUrl(): string;

  getBaseUrl(customBaseUrl?: string): string {
    return customBaseUrl ?? this.defaultBaseUrl();
  }

  buildHeaders(apiKey: string, extra?: Record<string, string>): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      ...extra,
    };
  }

  buildBody(
    messages: Message[],
    model: string,
    stream: boolean,
    options?: ChatStreamOptions,
  ): unknown {
    const body: Record<string, unknown> = {
      model,
      messages,
      stream,
    };
    if (stream) {
      body.stream_options = { include_usage: true };
    }
    if (options?.parameters) {
      Object.assign(body, options.parameters);
    }
    return body;
  }

  parseSSEChunk(chunk: string): string | null {
    if (!chunk || chunk === '[DONE]') return null;
    try {
      // Use best-effort parser to handle truncated JSON
      const data = bestEffortParse(chunk);
      const delta = data?.choices?.[0]?.delta?.content;
      return typeof delta === 'string' && delta.length > 0 ? delta : null;
    } catch {
      return null;
    }
  }
}

// ─────────────────────────────────────────────
// OpenAI
// ─────────────────────────────────────────────

export class OpenAIEngine extends OpenAICompatibleEngine {
  readonly id = 'openai';
  readonly name = 'OpenAI';

  protected defaultBaseUrl(): string {
    return 'https://api.openai.com/v1';
  }
}

// ─────────────────────────────────────────────
// DeepSeek
// ─────────────────────────────────────────────

export class DeepSeekEngine extends OpenAICompatibleEngine {
  readonly id = 'deepseek';
  readonly name = 'DeepSeek';

  protected defaultBaseUrl(): string {
    return 'https://api.deepseek.com/v1';
  }
}

// ─────────────────────────────────────────────
// MiniMax
// ─────────────────────────────────────────────

export class MiniMaxEngine extends OpenAICompatibleEngine {
  readonly id = 'minimax';
  readonly name = 'MiniMax';

  protected defaultBaseUrl(): string {
    return 'https://api.minimax.chat/v1';
  }
}

// ─────────────────────────────────────────────
// Moonshot (Kimi)
// ─────────────────────────────────────────────

export class MoonshotEngine extends OpenAICompatibleEngine {
  readonly id = 'moonshot';
  readonly name = 'Moonshot (Kimi)';

  protected defaultBaseUrl(): string {
    return 'https://api.moonshot.cn/v1';
  }
}

// ─────────────────────────────────────────────
// Groq
// ─────────────────────────────────────────────

export class GroqEngine extends OpenAICompatibleEngine {
  readonly id = 'groq';
  readonly name = 'Groq';

  protected defaultBaseUrl(): string {
    return 'https://api.groq.com/openai/v1';
  }
}

// ─────────────────────────────────────────────
// Cerebras
// ─────────────────────────────────────────────

export class CerebrasEngine extends OpenAICompatibleEngine {
  readonly id = 'cerebras';
  readonly name = 'Cerebras';

  protected defaultBaseUrl(): string {
    return 'https://api.cerebras.ai/v1';
  }
}

// ─────────────────────────────────────────────
// Perplexity
// ─────────────────────────────────────────────

export class PerplexityEngine extends OpenAICompatibleEngine {
  readonly id = 'perplexity';
  readonly name = 'Perplexity';

  protected defaultBaseUrl(): string {
    return 'https://api.perplexity.ai';
  }
}

// ─────────────────────────────────────────────
// xAI (Grok)
// ─────────────────────────────────────────────

export class xAIEngine extends OpenAICompatibleEngine {
  readonly id = 'xai';
  readonly name = 'xAI (Grok)';

  protected defaultBaseUrl(): string {
    return 'https://api.x.ai/v1';
  }
}

// ─────────────────────────────────────────────
// Azure OpenAI
// Azure requires a dynamic endpoint and an extra `api-version` query param.
// ─────────────────────────────────────────────

export class AzureOpenAIEngine extends OpenAICompatibleEngine {
  readonly id = 'azure';
  readonly name = 'Azure OpenAI';

  protected defaultBaseUrl(): string {
    // Azure base URL must be provided via customBaseUrl in the format:
    // https://<resource>.openai.azure.com/openai/deployments/<deployment>
    return 'https://YOUR_RESOURCE.openai.azure.com/openai/deployments/YOUR_DEPLOYMENT';
  }

  buildHeaders(apiKey: string, extra?: Record<string, string>): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'api-key': apiKey,
      ...extra,
    };
  }

  protected buildRequestUrl(options: ChatStreamOptions): string {
    const base = this.resolveBaseUrl(options.customBaseUrl);
    const apiVersion = (options.parameters?.apiVersion as string | undefined) ?? '2024-05-01-preview';
    return `${base}/chat/completions?api-version=${apiVersion}`;
  }

  buildBody(
    messages: Message[],
    model: string,
    stream: boolean,
    options?: ChatStreamOptions,
  ): unknown {
    const body = super.buildBody(messages, model, stream, options) as Record<string, unknown>;
    // Azure uses the deployment name — no need to pass model in body
    delete body.model;
    return body;
  }
}

// ─────────────────────────────────────────────
// LM Studio (local OpenAI-compatible server)
// ─────────────────────────────────────────────

export class LMStudioEngine extends OpenAICompatibleEngine {
  readonly id = 'lmstudio';
  readonly name = 'LM Studio';
  readonly requiresApiKey = false;
  readonly isLocal = true;

  protected defaultBaseUrl(): string {
    return 'http://localhost:1234/v1';
  }

  buildHeaders(apiKey: string, extra?: Record<string, string>): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...extra,
    };
    if (apiKey?.trim()) {
      headers.Authorization = `Bearer ${apiKey}`;
    }
    return headers;
  }
}

// ─────────────────────────────────────────────
// Ollama (local, uses /api/chat endpoint)
// Ollama uses a different request/response format than OpenAI.
// ─────────────────────────────────────────────

export class OllamaEngine extends BaseEngine {
  readonly id = 'ollama';
  readonly name = 'Ollama';
  readonly requiresApiKey = false;
  readonly isLocal = true;

  getBaseUrl(customBaseUrl?: string): string {
    return customBaseUrl ?? 'http://localhost:11434';
  }

  buildHeaders(_apiKey: string, extra?: Record<string, string>): Record<string, string> {
    return { 'Content-Type': 'application/json', ...extra };
  }

  buildBody(
    messages: Message[],
    model: string,
    stream: boolean,
    _options?: ChatStreamOptions,
  ): unknown {
    return {
      model,
      messages,
      stream,
    };
  }

  parseSSEChunk(chunk: string): string | null {
    if (!chunk || chunk === '[DONE]') return null;
    try {
      const data = bestEffortParse(chunk);
      // Ollama streaming: { message: { role, content }, done }
      const content = data?.message?.content;
      return typeof content === 'string' && content.length > 0 ? content : null;
    } catch {
      return null;
    }
  }

  protected buildRequestUrl(options: ChatStreamOptions): string {
    return `${this.resolveBaseUrl(options.customBaseUrl)}/api/chat`;
  }
}

