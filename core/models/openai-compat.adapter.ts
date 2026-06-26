/**
 * OpenAI-compatible chat completion adapter.
 *
 * Speaks the OpenAI `/v1/chat/completions` SSE protocol so any
 * provider that implements that endpoint (DeepSeek, 通义千问,
 * OpenRouter, Moonshot, Ollama, vLLM, etc.) can be used with the
 * same code path.
 *
 * The exported shape is intentionally narrow:
 *   - `chat(...)`  : streaming, returns the final aggregated message
 *   - `ping(...)`  : cheap connectivity check
 *
 * Both honour the `signal` argument and a 30s default timeout
 * (per the design doc). Errors are surfaced as plain `Error`
 * subclasses — `AbortError` is re-thrown untouched so callers can
 * distinguish user-initiated cancellation from genuine failures.
 */

import { EventSourceParserStream } from 'eventsource-parser/stream'
import type {
  ChatMessage,
  ChatOptions,
  Message,
  ModelConfigInput,
  PingResult,
  StreamDelta,
} from './types'

/** Default per-request timeout. */
export const DEFAULT_TIMEOUT_MS = 30_000

/** A small `Error` subclass for non-2xx responses. */
export class ChatHttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly statusText: string,
    public readonly body?: string
  ) {
    super(`OpenAI-compat HTTP ${status} ${statusText}${body ? `: ${body}` : ''}`)
    this.name = 'ChatHttpError'
  }
}

/** Normalise a base URL — strip trailing slashes, ensure no `/v1` suffix is doubled. */
function normalizeBaseUrl(baseUrl: string): string {
  let url = baseUrl.trim().replace(/\/+$/, '')
  // Allow callers to pass `https://api.openai.com` without `/v1`
  // — the endpoint we hit is always `/chat/completions`.
  if (!/\/(v1|v\d+)$/i.test(url)) {
    url = `${url}/v1`
  }
  return url
}

function buildHeaders(apiKey: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'text/event-stream',
  }
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`
  }
  return headers
}

function nowId(): string {
  // No external dep — collision-safe enough for a request id.
  return `chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Streaming chat completion.
 *
 * Calls the model with a `stream: true` request and pushes text
 * deltas to `onDelta`. The function resolves with the aggregated
 * assistant message once the server sends `data: [DONE]` (or the
 * stream is aborted). Network / HTTP errors reject the returned
 * promise.
 */
export async function chat(
  config: ModelConfigInput,
  messages: Message[],
  options: ChatOptions = {},
  onDelta?: (delta: StreamDelta) => void
): Promise<ChatMessage> {
  const baseUrl = normalizeBaseUrl(config.baseUrl)
  const url = `${baseUrl}/chat/completions`

  const temperature = options.temperature ?? config.temperature ?? 0.7
  const maxTokens = options.maxTokens ?? config.maxTokens
  const systemPrompt = options.systemPrompt ?? config.systemPrompt

  // System prompt precedence: explicit option > model-level config > none.
  const fullMessages: Message[] = []
  if (systemPrompt) {
    fullMessages.push({ role: 'system', content: systemPrompt })
  }
  fullMessages.push(...messages)

  const body: Record<string, unknown> = {
    model: config.model,
    messages: fullMessages,
    temperature,
    stream: true,
  }
  if (maxTokens) body.max_tokens = maxTokens
  if (options.topP !== undefined) body.top_p = options.topP

  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const outerSignal = options.signal

  // Build an AbortController that fires on either caller-abort or timeout.
  const controller = new AbortController()
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  let onOuterAbort: (() => void) | undefined

  if (outerSignal) {
    onOuterAbort = () => controller.abort()
    if (outerSignal.aborted) controller.abort()
    else outerSignal.addEventListener('abort', onOuterAbort)
  }
  if (!controller.signal.aborted) {
    timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  }

  const detach = () => {
    if (timeoutId) {
      clearTimeout(timeoutId)
      timeoutId = undefined
    }
    if (onOuterAbort && outerSignal) {
      outerSignal.removeEventListener('abort', onOuterAbort)
      onOuterAbort = undefined
    }
  }

  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: buildHeaders(config.apiKey),
      body: JSON.stringify(body),
      signal: controller.signal,
    })
  } catch (err) {
    detach()
    throw err
  }
  // If we get here the request is in flight; clear the timeout — the
  // server is now streaming.
  if (timeoutId) {
    clearTimeout(timeoutId)
    timeoutId = undefined
  }

  if (!response.ok) {
    const text = await safeReadText(response)
    detach()
    onDelta?.({ type: 'error', error: `HTTP ${response.status} ${response.statusText}` })
    throw new ChatHttpError(response.status, response.statusText, text)
  }
  if (!response.body) {
    detach()
    throw new ChatHttpError(0, 'no body', 'Response stream was empty')
  }

  const eventStream = response.body
    .pipeThrough(new TextDecoderStream('utf-8'))
    .pipeThrough(new EventSourceParserStream())

  const id = options.requestId ?? nowId()
  const createdAt = Date.now()
  let aggregated = ''
  let modelName = config.model
  let finishReason: string | undefined
  let usage: ChatMessage['usage']

  const reader = eventStream.getReader()
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      if (!value?.data) continue
      if (value.data === '[DONE]') {
        onDelta?.({ type: 'done', finishReason })
        break
      }
      let parsed: unknown
      try {
        parsed = JSON.parse(value.data)
      } catch {
        // Skip malformed chunks; the server may have included a comment line.
        continue
      }
      const obj = parsed as Record<string, unknown>
      if (typeof obj.model === 'string') modelName = obj.model
      if (obj.usage && typeof obj.usage === 'object') {
        const u = obj.usage as Record<string, unknown>
        usage = {
          promptTokens: typeof u.prompt_tokens === 'number' ? (u.prompt_tokens as number) : undefined,
          completionTokens:
            typeof u.completion_tokens === 'number' ? (u.completion_tokens as number) : undefined,
          totalTokens: typeof u.total_tokens === 'number' ? (u.total_tokens as number) : undefined,
        }
      }
      const choices = Array.isArray(obj.choices) ? obj.choices : []
      for (const choice of choices) {
        const c = choice as Record<string, unknown>
        if (typeof c.finish_reason === 'string') finishReason = c.finish_reason as string
        const delta = (c.delta as Record<string, unknown> | undefined) ?? {}
        const text = typeof delta.content === 'string' ? delta.content : undefined
        if (text) {
          aggregated += text
          onDelta?.({ type: 'text', content: text })
        }
        const reasoning =
          (delta as Record<string, unknown>).reasoning_content ??
          (delta as Record<string, unknown>).reasoning
        if (typeof reasoning === 'string' && reasoning.length > 0) {
          onDelta?.({ type: 'reasoning', content: reasoning })
        }
      }
    }
  } finally {
    try {
      reader.releaseLock()
    } catch {
      // ignore
    }
    detach()
  }

  return {
    id,
    role: 'assistant',
    content: aggregated,
    createdAt,
    model: modelName,
    finishReason,
    usage,
  }
}

/**
 * Cheap connectivity check. Sends a `max_tokens: 1` request and
 * reports the round-trip latency. Any 2xx response is considered
 * success.
 */
export async function ping(
  config: ModelConfigInput,
  signal?: AbortSignal
): Promise<PingResult> {
  const baseUrl = normalizeBaseUrl(config.baseUrl)
  const url = `${baseUrl}/chat/completions`
  const startedAt = Date.now()

  const controller = new AbortController()
  let onOuterAbort: (() => void) | undefined
  if (signal) {
    onOuterAbort = () => controller.abort()
    if (signal.aborted) controller.abort()
    else signal.addEventListener('abort', onOuterAbort)
  }
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS)

  // If the signal was already aborted (or our timeout fired
  // synchronously) short-circuit to avoid hitting fetch with an
  // already-aborted signal, which would also be reported as an
  // AbortError.
  if (controller.signal.aborted) {
    clearTimeout(timeoutId)
    if (onOuterAbort && signal) signal.removeEventListener('abort', onOuterAbort)
    return { ok: false, latency: 0, error: 'aborted' }
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: buildHeaders(config.apiKey),
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 1,
        stream: false,
      }),
      signal: controller.signal,
    })
    const latency = Date.now() - startedAt
    if (!response.ok) {
      return {
        ok: false,
        latency,
        status: response.status,
        error: `HTTP ${response.status} ${response.statusText}`,
      }
    }
    // Drain the body so the connection can be released.
    try {
      await response.text()
    } catch {
      // ignore
    }
    return { ok: true, latency, status: response.status }
  } catch (err) {
    const latency = Date.now() - startedAt
    if (err instanceof Error && err.name === 'AbortError') {
      return { ok: false, latency, error: 'aborted' }
    }
    return {
      ok: false,
      latency,
      error: err instanceof Error ? err.message : String(err),
    }
  } finally {
    clearTimeout(timeoutId)
    if (onOuterAbort && signal) signal.removeEventListener('abort', onOuterAbort)
  }
}

async function safeReadText(response: Response): Promise<string> {
  try {
    return (await response.text()).slice(0, 2000)
  } catch {
    return ''
  }
}
