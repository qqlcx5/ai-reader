/**
 * Provider metadata shared across UI components.
 * Single source of truth for display name, brand color, icon class, and default config.
 */
export interface ProviderMeta {
  id: string;
  name: string;
  description: string;
  color: string;
  defaultModel: string;
  defaultBaseUrl: string;
}

export const PROVIDER_META: Record<string, ProviderMeta> = {
  openai: {
    id: 'openai',
    name: 'OpenAI',
    description: 'GPT-4o, GPT-4 Turbo, o1 等 OpenAI 模型',
    color: '#10a37f',
    defaultModel: 'gpt-4o-mini',
    defaultBaseUrl: 'https://api.openai.com/v1',
  },
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic',
    description: 'Claude Sonnet, Haiku, Opus 等 Anthropic 模型',
    color: '#d97757',
    defaultModel: 'claude-3-5-sonnet-latest',
    defaultBaseUrl: 'https://api.anthropic.com',
  },
  gemini: {
    id: 'gemini',
    name: 'Google Gemini',
    description: 'Gemini 2.0 Flash, Pro 等 Google 模型',
    color: '#4285f4',
    defaultModel: 'gemini-2.0-flash-exp',
    defaultBaseUrl: 'https://generativelanguage.googleapis.com',
  },
  deepseek: {
    id: 'deepseek',
    name: 'DeepSeek',
    description: 'DeepSeek-V3, R1 等国产开源模型',
    color: '#5e72e4',
    defaultModel: 'deepseek-chat',
    defaultBaseUrl: 'https://api.deepseek.com',
  },
  ollama: {
    id: 'ollama',
    name: 'Ollama',
    description: '本地运行的 Ollama 模型（无需 API Key）',
    color: '#ffffff',
    defaultModel: 'llama3.2',
    defaultBaseUrl: 'http://localhost:11434',
  },
  custom: {
    id: 'custom',
    name: 'Custom OpenAI-compatible',
    description: 'OpenAI API 兼容服务（OpenRouter, Groq, Moonshot 等）',
    color: '#888888',
    defaultModel: 'gpt-4o-mini',
    defaultBaseUrl: '',
  },
};

export function getProviderIcon(id: string): string {
  return id in PROVIDER_META ? id : 'custom';
}

export function getProviderName(id: string): string {
  return PROVIDER_META[id]?.name ?? id;
}
