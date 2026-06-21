/**
 * Provider Factory
 *
 * Creates provider instances based on ProviderType.
 * Central registration point — to add a new provider, register it here
 * and create the implementation in providers/.
 */

import { BaseProvider } from './base';
import type { ProviderConfig } from './types';
import { ProviderError, UNKNOWN_PROVIDER } from './types';
import { OpenAIProvider } from './providers/openai';
import { AnthropicProvider } from './providers/anthropic';
import { GeminiProvider } from './providers/gemini';
import { CustomOpenAIProvider } from './providers/custom';

// ─── Provider Constructor Map ────────────────────────────────────────

type ProviderCtor = new (config: ProviderConfig) => BaseProvider;

const PROVIDER_REGISTRY: Record<string, ProviderCtor> = {
  openai: OpenAIProvider,
  anthropic: AnthropicProvider,
  gemini: GeminiProvider,
  custom: CustomOpenAIProvider,
};

// ─── Public API ─────────────────────────────────────────────────────

/**
 * Create a provider instance from configuration.
 *
 * @throws ProviderError if provider type is unknown
 */
export function createProvider(config: ProviderConfig): BaseProvider {
  const Ctor = PROVIDER_REGISTRY[config.type];
  if (!Ctor) {
    throw new ProviderError(
      UNKNOWN_PROVIDER,
      `Unknown provider type: "${config.type}". Supported: ${Object.keys(PROVIDER_REGISTRY).join(', ')}`,
    );
  }
  return new Ctor(config);
}

/**
 * List all registered provider type keys.
 */
export function getSupportedProviderTypes(): string[] {
  return Object.keys(PROVIDER_REGISTRY);
}

/**
 * Get the default model name for a provider type.
 */
export function getDefaultModel(type: string): string {
  switch (type) {
    case 'openai':
      return 'gpt-4o-mini';
    case 'anthropic':
      return 'claude-haiku-4.5';
    case 'gemini':
      return 'gemini-2.5-flash';
    case 'custom':
      return 'gpt-4o-mini';
    default:
      return '';
  }
}
