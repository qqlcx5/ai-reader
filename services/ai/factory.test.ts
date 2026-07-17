import { describe, it, expect } from 'vitest'
import { createProvider } from './factory'
import type { ModelConfig } from '@/types/model'

function makeConfig(provider: ModelConfig['provider']): ModelConfig {
  return {
    id: 'test',
    name: 'Test',
    provider,
    modelId: 'test-model',
    enabled: true,
    isDefault: false,
    contextWindow: 4096,
    temperature: 0.9,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

describe('createProvider', () => {
  it('should return OpenAICompatibleProvider for openai-compatible', () => {
    const provider = createProvider(makeConfig('openai-compatible'))
    expect(provider).toBeDefined()
    expect(typeof provider.chat).toBe('function')
    expect(typeof provider.streamChat).toBe('function')
    expect(typeof provider.testConnection).toBe('function')
  })

  it('should return AnthropicProvider for anthropic', () => {
    const provider = createProvider(makeConfig('anthropic'))
    expect(provider).toBeDefined()
    expect(typeof provider.chat).toBe('function')
    expect(typeof provider.streamChat).toBe('function')
    expect(typeof provider.testConnection).toBe('function')
  })

  it('should return OllamaProvider for ollama', () => {
    const provider = createProvider(makeConfig('ollama'))
    expect(provider).toBeDefined()
    expect(typeof provider.chat).toBe('function')
    expect(typeof provider.streamChat).toBe('function')
    expect(typeof provider.testConnection).toBe('function')
  })

  it('should throw for unknown provider', () => {
    expect(() => createProvider({ ...makeConfig('ollama'), provider: 'unknown' as never })).toThrow(/Unknown provider/)
  })

})
