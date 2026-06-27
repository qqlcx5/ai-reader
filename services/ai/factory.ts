import type { AIProvider } from './types'
import type { ModelConfig } from '@/types/model'
import { OpenAICompatibleProvider } from './openai-compatible'
import { AnthropicProvider } from './anthropic'
import { OllamaProvider } from './ollama'

const providerInstances: Record<string, AIProvider> = {}

function getSingleton(provider: string, factory: () => AIProvider): AIProvider {
  if (!providerInstances[provider]) {
    providerInstances[provider] = factory()
  }
  return providerInstances[provider]
}

export function createProvider(config: ModelConfig): AIProvider {
  switch (config.provider) {
    case 'openai-compatible':
      return getSingleton('openai-compatible', () => OpenAICompatibleProvider)
    case 'anthropic':
      return getSingleton('anthropic', () => AnthropicProvider)
    case 'ollama':
      return getSingleton('ollama', () => OllamaProvider)
    default: {
      const _exhaustive: never = config.provider
      throw new Error(`Unknown provider: ${_exhaustive}`)
    }
  }
}
