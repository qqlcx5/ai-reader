import type { AIProvider, ChatInput, ChatOutput, StreamCallbacks, TestConnectionResult } from './types'
import type { ModelConfig } from '@/types/model'
import { normalizeBaseUrl, fetchWithTimeout } from './shared'

interface OllamaMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

function buildOllamaMessages(input: ChatInput): OllamaMessage[] {
  const messages: OllamaMessage[] = []
  if (input.systemPrompt) {
    messages.push({ role: 'system', content: input.systemPrompt })
  }
  if (input.context) {
    messages.push({ role: 'system', content: input.context })
  }
  for (const m of input.messages) {
    if (m.role === 'system') {
      messages.push({ role: 'system', content: m.content })
    } else {
      messages.push({ role: m.role, content: m.content })
    }
  }
  return messages
}

export const OllamaProvider: AIProvider = {
  async chat(input: ChatInput): Promise<ChatOutput> {
    const baseUrl = normalizeBaseUrl(input.model.baseUrl || 'http://localhost:11434')
    const endpoint = `${baseUrl}/api/chat`

    const body = JSON.stringify({
      model: input.model.modelId,
      messages: buildOllamaMessages(input),
      num_ctx: input.model.contextWindow,
      temperature: input.model.temperature,
      stream: false,
    })

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    const response = await fetchWithTimeout(endpoint, {
      method: 'POST',
      headers,
      body,
      signal: input.signal,
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')

      if (response.status === 403) {
        throw new Error(
          `Ollama cannot process requests originating from a browser extension without setting OLLAMA_ORIGINS. ` +
          `See instructions at https://help.obsidian.md/web-clipper/interpreter`
        )
      }

      throw new Error(`Ollama error: ${response.statusText} ${errorText.slice(0, 300)}`)
    }

    const data = await response.json()
    const content = data.message?.content ?? ''

    return {
      content,
      usage: data.eval_count != null
        ? {
            promptTokens: data.prompt_eval_count,
            completionTokens: data.eval_count,
            totalTokens: (data.prompt_eval_count ?? 0) + (data.eval_count ?? 0),
          }
        : undefined,
    }
  },

  async streamChat(input: ChatInput, callbacks: StreamCallbacks): Promise<void> {
    const baseUrl = normalizeBaseUrl(input.model.baseUrl || 'http://localhost:11434')
    const endpoint = `${baseUrl}/api/chat`

    const body = JSON.stringify({
      model: input.model.modelId,
      messages: buildOllamaMessages(input),
      num_ctx: input.model.contextWindow,
      temperature: input.model.temperature,
      stream: true,
    })

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

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
      const errorText = await response.text().catch(() => '')

      if (response.status === 403) {
        callbacks.onError(new Error(
          `Ollama cannot process requests originating from a browser extension without setting OLLAMA_ORIGINS. ` +
          `See instructions at https://help.obsidian.md/web-clipper/interpreter`
        ))
        return
      }

      callbacks.onError(new Error(`Ollama error: ${response.statusText} ${errorText.slice(0, 300)}`))
      return
    }

    const reader = response.body?.getReader()
    if (!reader) {
      callbacks.onError(new Error('No response body'))
      return
    }

    const decoder = new TextDecoder()
    let buffer = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed) continue

          try {
            const event = JSON.parse(trimmed)
            const msgField = event.message
            // Thinking / reasoning content (some models via Ollama)
            if (msgField?.thinking) {
              callbacks.onReasoning?.(msgField.thinking)
            }
            if (msgField?.reasoning_content) {
              callbacks.onReasoning?.(msgField.reasoning_content)
            }
            const content = msgField?.content
            if (content) {
              callbacks.onToken(content)
            }
            if (event.done) {
              // stream naturally ends here — onDone will fire after while loop
            }
          } catch {
            // ignore malformed NDJSON lines
          }
        }
      }
      // Flush any remaining bytes in decoder and buffer
      buffer += decoder.decode()
      if (buffer.trim()) {
        try {
          const event = JSON.parse(buffer.trim())
          const msgField = event.message
          if (msgField?.thinking) {
            callbacks.onReasoning?.(msgField.thinking)
          }
          if (msgField?.reasoning_content) {
            callbacks.onReasoning?.(msgField.reasoning_content)
          }
          const content = msgField?.content
          if (content) {
            callbacks.onToken(content)
          }
        } catch {
          // ignore final partial line
        }
      }
      callbacks.onDone()
    } catch (e: unknown) {
      callbacks.onError(e instanceof Error ? e : new Error(String(e)))
    }
  },

  async testConnection(config: ModelConfig): Promise<TestConnectionResult> {
    const baseUrl = normalizeBaseUrl(config.baseUrl || 'http://localhost:11434')
    const endpoint = `${baseUrl}/api/tags`

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    const start = performance.now()
    try {
      const response = await fetchWithTimeout(endpoint, { method: 'GET', headers }, 10_000)
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
