import type { AIProvider, ChatInput, ChatOutput, StreamCallbacks, TestConnectionResult } from './types'
import type { ModelConfig } from '@/types/model'
import { createParser, type EventSourceMessage } from 'eventsource-parser'
import { normalizeBaseUrl, fetchWithTimeout } from './shared'

export const OpenAICompatibleProvider: AIProvider = {
  async chat(input: ChatInput): Promise<ChatOutput> {
    const baseUrl = normalizeBaseUrl(input.model.baseUrl || 'https://api.openai.com/v1')
    const endpoint = `${baseUrl}/chat/completions`

    const messages: { role: string; content: string }[] = []
    if (input.systemPrompt) {
      messages.push({ role: 'system', content: input.systemPrompt })
    }
    if (input.context) {
      messages.push({ role: 'system', content: input.context })
    }
    messages.push(...input.messages.map((m) => ({ role: m.role, content: m.content })))

    const body = JSON.stringify({
      model: input.model.modelId,
      messages,
      temperature: input.model.temperature,
      max_tokens: input.model.contextWindow,
    })

    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (input.model.apiKey) {
      headers['Authorization'] = `Bearer ${input.model.apiKey}`
    }

    const response = await fetchWithTimeout(endpoint, {
      method: 'POST',
      headers,
      body,
      signal: input.signal,
    })

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw new Error(`OpenAI Compatible error: ${response.statusText} ${text.slice(0, 300)}`)
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content ?? ''
    const usage = data.usage
      ? {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens,
        }
      : undefined

    return { content, usage }
  },

  async streamChat(input: ChatInput, callbacks: StreamCallbacks): Promise<void> {
    const baseUrl = normalizeBaseUrl(input.model.baseUrl || 'https://api.openai.com/v1')
    const endpoint = `${baseUrl}/chat/completions`

    const messages: { role: string; content: string }[] = []
    if (input.systemPrompt) {
      messages.push({ role: 'system', content: input.systemPrompt })
    }
    if (input.context) {
      messages.push({ role: 'system', content: input.context })
    }
    messages.push(...input.messages.map((m) => ({ role: m.role, content: m.content })))

    const body = JSON.stringify({
      model: input.model.modelId,
      messages,
      temperature: input.model.temperature,
      max_tokens: input.model.contextWindow,
      stream: true,
    })

    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (input.model.apiKey) {
      headers['Authorization'] = `Bearer ${input.model.apiKey}`
    }

    let response: Response
    try {
      response = await fetchWithTimeout(endpoint, {
        method: 'POST',
        headers,
        body,
        signal: input.signal,
      })
    } catch (e: any) {
      callbacks.onError(e)
      return
    }

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      callbacks.onError(new Error(`OpenAI Compatible error: ${response.statusText} ${text.slice(0, 300)}`))
      return
    }

    const reader = response.body?.getReader()
    if (!reader) {
      callbacks.onError(new Error('No response body'))
      return
    }

    const decoder = new TextDecoder()
    const parser = createParser({
      onEvent: (event: EventSourceMessage) => {
        if (event.data === '[DONE]') return
        try {
          const parsed = JSON.parse(event.data)
          const delta = parsed.choices?.[0]?.delta?.content
          if (delta) {
            callbacks.onToken(delta)
          }
        } catch {
          // ignore malformed chunks
        }
      },
    })

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        parser.feed(decoder.decode(value, { stream: true }))
      }
      callbacks.onDone()
    } catch (e: any) {
      callbacks.onError(e)
    }
  },

  async testConnection(config: ModelConfig): Promise<TestConnectionResult> {
    const baseUrl = normalizeBaseUrl(config.baseUrl || 'https://api.openai.com/v1')
    const endpoint = `${baseUrl}/chat/completions`

    const body = JSON.stringify({
      model: config.modelId,
      messages: [{ role: 'user', content: 'ping' }],
      max_tokens: 1,
    })

    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (config.apiKey) {
      headers['Authorization'] = `Bearer ${config.apiKey}`
    }

    const start = performance.now()
    try {
      const response = await fetchWithTimeout(endpoint, { method: 'POST', headers, body }, 10_000)
      const latency = Math.round(performance.now() - start)

      if (!response.ok) {
        const text = await response.text().catch(() => '')
        return { success: false, latency, error: `HTTP ${response.status}: ${text.slice(0, 200)}` }
      }

      return { success: true, latency }
    } catch (e: any) {
      return { success: false, latency: Math.round(performance.now() - start), error: e?.message ?? String(e) }
    }
  },
}
