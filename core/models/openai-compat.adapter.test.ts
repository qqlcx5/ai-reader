/**
 * Unit tests for the OpenAI-compatible adapter.
 *
 * We mock `globalThis.fetch` directly so we can assert both
 * success and failure paths without hitting a network. For the
 * streaming test we build a fake SSE response body from a
 * string[] and pipe it through a `ReadableStream`.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { chat, ping, ChatHttpError, DEFAULT_TIMEOUT_MS } from './openai-compat.adapter'
import type { ModelConfigInput, StreamDelta } from './types'

const baseConfig: ModelConfigInput = {
  id: 'm1',
  name: 'Test Model',
  baseUrl: 'https://api.example.com/v1',
  apiKey: 'sk-test',
  model: 'test-model',
}

/* ====================== Helpers ====================== */

function makeJsonResponse(
  body: unknown,
  init: { status?: number; statusText?: string; contentType?: string } = {}
): Response {
  const status = init.status ?? 200
  const statusText = init.statusText ?? 'OK'
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status,
    statusText,
    headers: { 'Content-Type': init.contentType ?? 'application/json' },
  })
}

/** Build an SSE `ReadableStream` from a list of `data:` payloads. */
function makeSSEResponse(events: string[], init: { status?: number; statusText?: string } = {}): Response {
  const status = init.status ?? 200
  const statusText = init.statusText ?? 'OK'
  const sseBody = events.map((e) => `data: ${e}\n\n`).join('') + 'data: [DONE]\n\n'
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(sseBody))
      controller.close()
    },
  })
  return new Response(stream, {
    status,
    statusText,
    headers: { 'Content-Type': 'text/event-stream' },
  })
}

function makeStreamingResponseFromChunks(
  chunks: string[],
  init: { status?: number; statusText?: string; delayMs?: number } = {}
): Response {
  const status = init.status ?? 200
  const statusText = init.statusText ?? 'OK'
  const encoder = new TextEncoder()
  const delayMs = init.delayMs ?? 0
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      for (const chunk of chunks) {
        if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs))
        controller.enqueue(encoder.encode(chunk))
      }
      controller.close()
    },
  })
  return new Response(stream, {
    status,
    statusText,
    headers: { 'Content-Type': 'text/event-stream' },
  })
}

/* ====================== Tests ====================== */

describe('ping()', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('returns ok=true with latency on 200', async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeJsonResponse({ choices: [{ message: { content: 'pong' } }] }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await ping(baseConfig)
    expect(result.ok).toBe(true)
    expect(result.status).toBe(200)
    expect(result.latency).toBeGreaterThanOrEqual(0)
    expect(result.error).toBeUndefined()

    // Verify URL + method
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.example.com/v1/chat/completions')
    expect(init.method).toBe('POST')
    const body = JSON.parse(init.body)
    expect(body.model).toBe('test-model')
    expect(body.max_tokens).toBe(1)
    expect(body.stream).toBe(false)
    expect(init.headers.Authorization).toBe('Bearer sk-test')

    vi.unstubAllGlobals()
  })

  it('returns ok=false on 401', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(makeJsonResponse({ error: 'unauthorized' }, { status: 401, statusText: 'Unauthorized' }))
    )
    const result = await ping(baseConfig)
    expect(result.ok).toBe(false)
    expect(result.status).toBe(401)
    expect(result.error).toMatch(/401/)
    vi.unstubAllGlobals()
  })

  it('returns ok=false on network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    const result = await ping(baseConfig)
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/Failed to fetch/)
    expect(result.latency).toBeGreaterThanOrEqual(0)
    vi.unstubAllGlobals()
  })

  it('returns ok=false with aborted message when signal is already aborted', async () => {
    const controller = new AbortController()
    controller.abort()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeJsonResponse({})))
    const result = await ping(baseConfig, controller.signal)
    expect(result.ok).toBe(false)
    expect(result.error).toBe('aborted')
    vi.unstubAllGlobals()
  })

  it('appends /v1 to baseUrl missing it', async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeJsonResponse({}))
    vi.stubGlobal('fetch', fetchMock)
    await ping({ ...baseConfig, baseUrl: 'https://api.example.com' })
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.example.com/v1/chat/completions')
    vi.unstubAllGlobals()
  })
})

describe('chat()', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('aggregates streaming deltas and resolves with final message', async () => {
    const events = [
      JSON.stringify({ id: 'cmpl-1', model: 'test-model', choices: [{ index: 0, delta: { role: 'assistant', content: 'Hello' }, finish_reason: null }] }),
      JSON.stringify({ id: 'cmpl-1', model: 'test-model', choices: [{ index: 0, delta: { content: ' 世界' }, finish_reason: null }] }),
      JSON.stringify({ id: 'cmpl-1', model: 'test-model', choices: [{ index: 0, delta: { content: '！' }, finish_reason: 'stop' }] }),
    ]
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeSSEResponse(events)))

    const deltas: StreamDelta[] = []
    const result = await chat(
      baseConfig,
      [{ role: 'user', content: '你好' }],
      {},
      (d) => deltas.push(d)
    )

    expect(result.content).toBe('Hello 世界！')
    expect(result.role).toBe('assistant')
    expect(result.model).toBe('test-model')
    expect(result.finishReason).toBe('stop')
    expect(deltas.filter((d) => d.type === 'text').map((d) => d.content).join('')).toBe('Hello 世界！')
    // Last delta should be `done`
    expect(deltas[deltas.length - 1].type).toBe('done')
  })

  it('forwards systemPrompt from options and skips model-level one', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        makeSSEResponse([JSON.stringify({ choices: [{ delta: { content: 'ok' } }] })])
      )
    )
    const fetchMock = vi.mocked(fetch)
    await chat(
      { ...baseConfig, systemPrompt: 'should be overridden' },
      [{ role: 'user', content: 'hi' }],
      { systemPrompt: 'use me' }
    )
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.messages[0]).toEqual({ role: 'system', content: 'use me' })
    expect(body.messages[1]).toEqual({ role: 'user', content: 'hi' })
  })

  it('uses model-level systemPrompt when no option is given', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        makeSSEResponse([JSON.stringify({ choices: [{ delta: { content: 'ok' } }] })])
      )
    )
    const fetchMock = vi.mocked(fetch)
    await chat({ ...baseConfig, systemPrompt: 'global prompt' }, [{ role: 'user', content: 'hi' }])
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.messages[0]).toEqual({ role: 'system', content: 'global prompt' })
  })

  it('throws ChatHttpError on non-2xx response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        makeJsonResponse({ error: 'rate limited' }, { status: 429, statusText: 'Too Many Requests' })
      )
    )
    await expect(chat(baseConfig, [{ role: 'user', content: 'hi' }])).rejects.toBeInstanceOf(ChatHttpError)
  })

  it('aborts mid-stream when AbortController fires', async () => {
    const controller = new AbortController()
    // Build a streaming response that yields a chunk, then keeps
    // the stream open until we abort.
    const encoder = new TextEncoder()
    let interval: ReturnType<typeof setInterval> | undefined
    const stream = new ReadableStream<Uint8Array>({
      start(ctrl) {
        ctrl.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ choices: [{ delta: { content: 'first' } }] })}\n\n`
          )
        )
        interval = setInterval(() => {
          if (controller.signal.aborted) {
            ctrl.error(new DOMException('aborted', 'AbortError'))
            clearInterval(interval)
            return
          }
          try {
            ctrl.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ choices: [{ delta: { content: 'more' } }] })}\n\n`
              )
            )
          } catch {
            // already closed
          }
        }, 5)
      },
      cancel() {
        if (interval) clearInterval(interval)
      },
    })
    const response = new Response(stream, {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response))

    // Schedule an abort after a tick.
    setTimeout(() => controller.abort(), 20)

    await expect(
      chat(baseConfig, [{ role: 'user', content: 'hi' }], { signal: controller.signal })
    ).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('aborts on timeout when no timeout option is provided', async () => {
    vi.useFakeTimers()
    try {
      // Capture the AbortSignal from the fetch call and reject
      // when it aborts. This matches the real fetch behaviour
      // under our 30s timeout.
      const fetchMock = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
        return new Promise<Response>((_resolve, reject) => {
          const signal = init?.signal as AbortSignal | undefined
          if (signal) {
            if (signal.aborted) reject(new DOMException('aborted', 'AbortError'))
            else signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
          }
        })
      })
      vi.stubGlobal('fetch', fetchMock)

      const promise = chat(baseConfig, [{ role: 'user', content: 'hi' }])
      // Attach the rejection assertion BEFORE advancing timers.
      const expectation = expect(promise).rejects.toBeInstanceOf(DOMException)
      await vi.advanceTimersByTimeAsync(DEFAULT_TIMEOUT_MS + 100)
      await expectation
    } finally {
      vi.useRealTimers()
      vi.unstubAllGlobals()
    }
  })

  it('parses usage block when included in final chunk', async () => {
    const events = [
      JSON.stringify({ choices: [{ delta: { content: 'hi' } }] }),
      JSON.stringify({
        choices: [{ delta: {}, finish_reason: 'stop' }],
        usage: { prompt_tokens: 7, completion_tokens: 2, total_tokens: 9 },
      }),
    ]
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeSSEResponse(events)))
    const result = await chat(baseConfig, [{ role: 'user', content: 'ping' }])
    expect(result.usage).toEqual({ promptTokens: 7, completionTokens: 2, totalTokens: 9 })
  })

  it('skips malformed SSE chunks without throwing', async () => {
    const chunks = [
      'data: not-json\n\n',
      `data: ${JSON.stringify({ choices: [{ delta: { content: 'ok' } }] })}\n\n`,
      'data: [DONE]\n\n',
    ]
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeStreamingResponseFromChunks(chunks)))
    const result = await chat(baseConfig, [{ role: 'user', content: 'hi' }])
    expect(result.content).toBe('ok')
  })
})
