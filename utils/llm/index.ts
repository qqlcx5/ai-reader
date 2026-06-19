import type { LLMProvider } from './types';
import { openaiProvider } from './openai-provider';
import { anthropicProvider } from './anthropic-provider';
import { geminiProvider } from './gemini-provider';
import { ollamaProvider } from './ollama-provider';
import { customProvider } from './custom-provider';

export const PROVIDERS: Record<string, LLMProvider> = {
  openai: openaiProvider,
  anthropic: anthropicProvider,
  gemini: geminiProvider,
  ollama: ollamaProvider,
  custom: customProvider,
};

export function getProvider(id: string): LLMProvider {
  const provider = PROVIDERS[id];
  if (!provider) throw new Error(`Unknown provider: ${id}`);
  return provider;
}

export type { LLMProvider, ProviderConfig, StreamRequest } from './types';
