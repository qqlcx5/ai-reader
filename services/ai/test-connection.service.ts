import type { ModelConfig } from '@/types/model'

export interface TestResult {
  success: boolean
  latency: number
  error?: string
}

const TIMEOUT_MS = 10_000

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { ...options, signal: controller.signal })
    return response
  } finally {
    clearTimeout(timer)
  }
}

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, '')
}

async function testOpenAICompatible(model: ModelConfig): Promise<TestResult> {
  const baseUrl = normalizeBaseUrl(model.baseUrl || 'https://api.openai.com/v1')
  const endpoint = `${baseUrl}/chat/completions`

  const body = JSON.stringify({
    model: model.modelId,
    messages: [{ role: 'user', content: 'ping' }],
    max_tokens: 1,
  })

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (model.apiKey) {
    headers['Authorization'] = `Bearer ${model.apiKey}`
  }

  const start = performance.now()
  const response = await fetchWithTimeout(endpoint, {
    method: 'POST',
    headers,
    body,
  }, TIMEOUT_MS)
  const latency = Math.round(performance.now() - start)

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    return { success: false, latency, error: `HTTP ${response.status}: ${text.slice(0, 200)}` }
  }

  return { success: true, latency }
}

async function testAnthropic(model: ModelConfig): Promise<TestResult> {
  const baseUrl = normalizeBaseUrl(model.baseUrl || 'https://api.anthropic.com')
  const endpoint = `${baseUrl}/v1/messages`

  const body = JSON.stringify({
    model: model.modelId,
    max_tokens: 1,
    messages: [{ role: 'user', content: 'ping' }],
  })

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-api-key': model.apiKey || '',
    'anthropic-version': '2023-06-01',
  }

  const start = performance.now()
  const response = await fetchWithTimeout(endpoint, {
    method: 'POST',
    headers,
    body,
  }, TIMEOUT_MS)
  const latency = Math.round(performance.now() - start)

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    return { success: false, latency, error: `HTTP ${response.status}: ${text.slice(0, 200)}` }
  }

  return { success: true, latency }
}

async function testOllama(model: ModelConfig): Promise<TestResult> {
  const baseUrl = normalizeBaseUrl(model.baseUrl || 'http://localhost:11434')
  const endpoint = `${baseUrl}/api/tags`

  const start = performance.now()
  const response = await fetchWithTimeout(endpoint, { method: 'GET' }, TIMEOUT_MS)
  const latency = Math.round(performance.now() - start)

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    return { success: false, latency, error: `HTTP ${response.status}: ${text.slice(0, 200)}` }
  }

  return { success: true, latency }
}

export async function testConnection(model: ModelConfig): Promise<TestResult> {
  try {
    switch (model.provider) {
      case 'openai-compatible':
        return await testOpenAICompatible(model)
      case 'anthropic':
        return await testAnthropic(model)
      case 'ollama':
        return await testOllama(model)
      default:
        return { success: false, latency: 0, error: `Unknown provider: ${(model as any).provider}` }
    }
  } catch (e: any) {
    return { success: false, latency: 0, error: e?.message ?? String(e) }
  }
}
