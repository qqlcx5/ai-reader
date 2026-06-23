/**
 * M3 多模型 Provider 客户端 — ChatGPT Web Session 模式（实验性）
 *
 * ⚠️ 实验性功能：需要用户在 Options 页手动启用。
 *
 * 工作原理：
 *   - 从 chrome.cookies 中读取 ChatGPT session token（__Secure-next-auth.session-token）
 *   - 调用 ChatGPT 非官方 Web API（chat.openai.com/backend-api/conversation）
 *   - 零 OpenAI API 额度消耗（使用 ChatGPT Web 免费层/Plus 订阅）
 *
 * 注意：
 *   - OpenAI 未公开此 API，随时可能失效
 *   - 需要用户已登录 chat.openai.com
 *   - 使用需遵守 OpenAI 服务条款
 */

import { BaseEngine } from './base-engine';
import type { Message, ChatStreamOptions, RequestMetrics, ProviderError } from './types';
import { EngineError, ERR_ABORTED, ERR_AUTH, ERR_NETWORK } from './types';
import { createParser, type EventSourceMessage } from 'eventsource-parser';
import { estimateCost } from './pricing';

const CHATGPT_WEB_DOMAIN = 'chat.openai.com';
const CHATGPT_SESSION_COOKIE = '__Secure-next-auth.session-token';
const CHATGPT_API_BASE = 'https://chat.openai.com/backend-api';

export class ChatGPTWebEngine extends BaseEngine {
  readonly id = 'chatgpt-web';
  readonly name = 'ChatGPT Web（实验性）';
  readonly requiresApiKey = false;
  readonly isLocal = false;
  readonly experimental = true;

  getBaseUrl(customBaseUrl?: string): string {
    return customBaseUrl ?? CHATGPT_API_BASE;
  }

  buildHeaders(_apiKey: string, extra?: Record<string, string>): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      ...extra,
    };
  }

  buildBody(
    messages: Message[],
    model: string,
    _stream: boolean,
    _options?: ChatStreamOptions,
  ): unknown {
    const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user');
    return {
      action: 'next',
      messages: [
        {
          id: crypto.randomUUID(),
          author: { role: 'user' },
          content: { content_type: 'text', parts: [lastUserMessage?.content ?? ''] },
        },
      ],
      model: model || 'text-davinci-002-render-sha',
      parent_message_id: crypto.randomUUID(),
    };
  }

  parseSSEChunk(chunk: string): string | null {
    if (!chunk || chunk === '[DONE]') return null;
    try {
      const data = JSON.parse(chunk);
      const parts = data?.message?.content?.parts;
      if (!Array.isArray(parts)) return null;
      // ChatGPT Web sends full accumulated text in each chunk, not deltas
      // Store the last full text and compute delta externally
      return parts.join('') || null;
    } catch {
      return null;
    }
  }

  // ── Override chatStream for ChatGPT Web session handling ─────────────────

  override async chatStream(options: ChatStreamOptions): Promise<RequestMetrics> {
    const { messages, model, customBaseUrl, systemPrompt, signal, onDelta, onMetrics, onError } = options;

    // Retrieve session token from chrome.cookies
    const sessionToken = await this._getSessionToken();
    if (!sessionToken) {
      const err: ProviderError = {
        code: ERR_AUTH,
        message: '未找到 ChatGPT Session Token。请先登录 chat.openai.com 后再使用此 Provider。',
        provider: this.id,
        retryable: false,
      };
      onError(err);
      throw new EngineError(err);
    }

    const fullMessages: Message[] = systemPrompt
      ? [{ role: 'system', content: systemPrompt }, ...messages]
      : messages;

    const startTime = performance.now();
    let firstTokenTime: number | null = null;

    const body = this.buildBody(fullMessages, model, true, options);
    const url = `${this.resolveBaseUrl(customBaseUrl)}/conversation`;

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `${CHATGPT_SESSION_COOKIE}=${sessionToken}`,
        },
        body: JSON.stringify(body),
        signal,
      });
    } catch (err: unknown) {
      if (signal.aborted || (err instanceof Error && err.name === 'AbortError')) {
        throw new EngineError({ code: ERR_ABORTED, message: 'Aborted', provider: this.id });
      }
      const provErr = { code: ERR_NETWORK, message: String(err), provider: this.id, retryable: true };
      onError(provErr);
      throw new EngineError(provErr);
    }

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      const err: ProviderError = {
        code: response.status === 401 || response.status === 403 ? ERR_AUTH : `HTTP_${response.status}`,
        message: `ChatGPT Web API error ${response.status}: ${text.slice(0, 200)}`,
        provider: this.id,
        httpStatus: response.status,
      };
      onError(err);
      throw new EngineError(err);
    }

    const reader = response.body!.getReader();
    const decoder = new TextDecoder('utf-8', { fatal: false });
    let lastFullText = '';

    const parser = createParser({
      onEvent: (event: EventSourceMessage) => {
        if (!event.data || event.data === '[DONE]') return;
        try {
          const data = JSON.parse(event.data);
          const fullText = data?.message?.content?.parts?.join('') ?? '';
          if (fullText && fullText !== lastFullText) {
            const delta = fullText.slice(lastFullText.length);
            if (delta.length > 0) {
              if (firstTokenTime === null) firstTokenTime = performance.now();
              onDelta(delta);
              lastFullText = fullText;
            }
          }
        } catch { /* ignore */ }
      },
    });

    try {
      while (true) {
        if (signal.aborted) throw new EngineError({ code: ERR_ABORTED, message: 'Aborted', provider: this.id });
        const { done, value } = await reader.read();
        if (done) break;
        parser.feed(decoder.decode(value, { stream: true }));
      }
    } finally {
      reader.releaseLock();
    }

    const endTime = performance.now();
    const totalLatency = endTime - startTime;
    const ttft = firstTokenTime !== null ? firstTokenTime - startTime : 0;
    // ChatGPT Web doesn't expose token counts
    const estimatedTokens = Math.ceil(lastFullText.length / 4);
    const metrics: RequestMetrics = {
      ttft,
      tps: 0,
      totalTokens: estimatedTokens,
      cost: 0, // Free tier — no cost to estimate
      cached: false,
      promptTokens: 0,
      completionTokens: estimatedTokens,
      totalLatency,
    };
    onMetrics(metrics);
    return metrics;
  }

  // ── chrome.cookies helper ────────────────────

  private async _getSessionToken(): Promise<string | undefined> {
    try {
      const cookie = await chrome.cookies.get({
        url: `https://${CHATGPT_WEB_DOMAIN}`,
        name: CHATGPT_SESSION_COOKIE,
      });
      return cookie?.value;
    } catch {
      return undefined;
    }
  }
}
