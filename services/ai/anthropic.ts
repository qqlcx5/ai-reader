import type { AIProvider, ChatInput, ChatOutput, StreamCallbacks, TestConnectionResult } from './types'
import type { ModelConfig } from '@/types/model'
import { createParser, type EventSourceMessage } from 'eventsource-parser'
import { normalizeBaseUrl, fetchWithTimeout } from './shared'

interface AnthropicMessage {
  role: 'user' | 'assistant'
  content: string
}

function buildAnthropicMessages(input: ChatInput): AnthropicMessage[] {
  const messages: AnthropicMessage[] = []
  for (const m of input.messages) {
    if (m.role === 'system') continue
    messages.push({ role: m.role as 'user' | 'assistant', content: m.content })
  }
  return messages
}

function buildAnthropicRequestBody(input: ChatInput, stream: boolean) {
  const messages = buildAnthropicMessages(input)
  const model = input.model
  const body: Record<string, unknown> = {
    model: model.modelId,
    messages,
    stream,
  }
  if (model.maxTokens != null) {
    body.max_tokens = model.maxTokens
  }
  if (model.temperature != null) {
    body.temperature = model.temperature
  }
  if (model.thinking?.enabled) {
    body.thinking = {
      type: 'enabled',
      ...(model.thinking.budgetTokens ? { budget_tokens: model.thinking.budgetTokens } : {}),
    }
  }
  if (input.systemPrompt) {
    body.system = input.systemPrompt
  }
  return body
}

function buildAnthropicHeaders(apiKey?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'anthropic-version': '2023-06-01',
    'anthropic-dangerous-direct-browser-access': 'true',
  }
  if (apiKey) {
    headers['x-api-key'] = apiKey
  }
  return headers
}

export const AnthropicProvider: AIProvider = {
  async chat(input: ChatInput): Promise<ChatOutput> {
    const baseUrl = normalizeBaseUrl(input.model.baseUrl || 'https://api.anthropic.com/v1')
    const endpoint = `${baseUrl}/messages`

    const body = JSON.stringify(buildAnthropicRequestBody(input, false))
    const headers = buildAnthropicHeaders(input.model.apiKey)

    const response = await fetchWithTimeout(endpoint, {
      method: 'POST',
      headers,
      body,
      signal: input.signal,
    })

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw new Error(`Anthropic error: ${response.statusText} ${text.slice(0, 300)}`)
    }

    const data = await response.json()
    const contentBlocks = data.content as Array<{ type: string; text?: string }> | undefined
    const content = contentBlocks?.find((b) => b.type === 'text')?.text ?? ''

    return {
      content,
      usage: data.usage
        ? {
            promptTokens: data.usage.input_tokens,
            completionTokens: data.usage.output_tokens,
            totalTokens: (data.usage.input_tokens ?? 0) + (data.usage.output_tokens ?? 0),
          }
        : undefined,
    }
  },

  async streamChat(input: ChatInput, callbacks: StreamCallbacks): Promise<void> {
    const baseUrl = normalizeBaseUrl(input.model.baseUrl || 'https://api.anthropic.com/v1')
    const endpoint = `${baseUrl}/messages`

    const body = JSON.stringify(buildAnthropicRequestBody(input, true))
    const headers = buildAnthropicHeaders(input.model.apiKey)

    let response: Response
    try {
      response = await fetchWithTimeout(endpoint, {
        method: 'POST',
        headers,
        body,
        signal: input.signal,
      })
    } catch (e: unknown) {
      callbacks.onError(e instanceof Error ? e : new Error(String(e)))
      return
    }

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      callbacks.onError(new Error(`Anthropic error: ${response.statusText} ${text.slice(0, 300)}`))
      return
    }

    const reader = response.body?.getReader()
    if (!reader) {
      callbacks.onError(new Error('No response body'))
      return
    }

    const decoder = new TextDecoder()
    let inputTokens: number | undefined
    let outputTokens: number | undefined
    const parser = createParser({
      onEvent: (event: EventSourceMessage) => {
        try {
          const parsed = JSON.parse(event.data)

          if (parsed.type === 'content_block_start') {
            // Track if this block is a thinking block via its index
            const block = parsed.content_block
            if (block?.type === 'thinking') {
              // Thinking blocks may have initial thinking text
              if (block.thinking) {
                callbacks.onReasoning?.(block.thinking)
              }
            }
          } else if (parsed.type === 'content_block_delta') {
            // Thinking delta
            if (parsed.delta?.thinking) {
              callbacks.onReasoning?.(parsed.delta.thinking)
            }
            // Normal text delta
            const text = parsed.delta?.text
            if (text) {
              callbacks.onToken(text)
            }
          } else if (parsed.type === 'message_start') {
            // input_tokens arrive in the message_start event
            const u = parsed.message?.usage
            if (u?.input_tokens != null) inputTokens = u.input_tokens
          } else if (parsed.type === 'message_delta') {
            // output_tokens is cumulative across message_delta events
            const u = parsed.usage
            if (u?.output_tokens != null) outputTokens = u.output_tokens
          } else if (parsed.type === 'error') {
            callbacks.onError(new Error(parsed.error?.message ?? 'Anthropic stream error'))
          }
        } catch {
          // ignore malformed JSON events
        }
      },
    })

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        parser.feed(decoder.decode(value, { stream: true }))
      }
      // Flush any remaining bytes buffered in the decoder
      const remainder = decoder.decode()
      if (remainder) {
        parser.feed(remainder)
      }
      if (inputTokens != null || outputTokens != null) {
        callbacks.onUsage?.({
          promptTokens: inputTokens,
          completionTokens: outputTokens,
          totalTokens: (inputTokens ?? 0) + (outputTokens ?? 0),
        })
      }
      callbacks.onDone()
    } catch (e: unknown) {
      callbacks.onError(e instanceof Error ? e : new Error(String(e)))
    }
  },

  async testConnection(config: ModelConfig): Promise<TestConnectionResult> {
    const baseUrl = normalizeBaseUrl(config.baseUrl || 'https://api.anthropic.com/v1')
    const endpoint = `${baseUrl}/messages`

    const body = JSON.stringify({
      model: config.modelId,
      max_tokens: 1,
      messages: [{ role: 'user', content: 'ping' }],
    })

    const headers = buildAnthropicHeaders(config.apiKey)

    const start = performance.now()
    try {
      const response = await fetchWithTimeout(endpoint, { method: 'POST', headers, body }, 10_000)
      const latency = Math.round(performance.now() - start)

      if (!response.ok) {
        const text = await response.text().catch(() => '')
        return { success: false, latency, error: `HTTP ${response.status}: ${text.slice(0, 200)}` }
      }

      return { success: true, latency }
    } catch (e: unknown) {
      return {
        success: false,
        latency: Math.round(performance.now() - start),
        error: e instanceof Error ? e.message : String(e),
      }
    }
  },
}
