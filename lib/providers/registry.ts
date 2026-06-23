/**
 * M3 多模型 Provider 客户端 — Provider 注册表与工厂
 *
 * 统一注册所有 Provider 实例，提供：
 *   - getEngine(id): 按 ID 获取 IEngine 实例
 *   - listEngines(): 返回带配置状态的 EngineInfo 列表
 *   - createFailoverChain(): 根据用户配置构建故障转移链
 */

import type { IEngine, EngineInfo } from './types';
import {
  OpenAIEngine,
  DeepSeekEngine,
  MiniMaxEngine,
  MoonshotEngine,
  GroqEngine,
  CerebrasEngine,
  PerplexityEngine,
  xAIEngine,
  AzureOpenAIEngine,
  LMStudioEngine,
  OllamaEngine,
} from './openai-compatible';
import { AnthropicEngine } from './anthropic-engine';
import { GeminiEngine } from './gemini-engine';
import { CohereEngine } from './cohere-engine';
import { ChatGPTWebEngine } from './chatgpt-web-engine';
import { hasKey } from './key-store';

// ─────────────────────────────────────────────
// Static engine instances (singletons)
// ─────────────────────────────────────────────

const ENGINE_INSTANCES: IEngine[] = [
  new OpenAIEngine(),
  new AnthropicEngine(),
  new GeminiEngine(),
  new DeepSeekEngine(),
  new GroqEngine(),
  new CerebrasEngine(),
  new PerplexityEngine(),
  new xAIEngine(),
  new MoonshotEngine(),
  new MiniMaxEngine(),
  new CohereEngine(),
  new AzureOpenAIEngine(),
  new LMStudioEngine(),
  new OllamaEngine(),
  new ChatGPTWebEngine(),
];

const ENGINE_MAP = new Map<string, IEngine>(
  ENGINE_INSTANCES.map((e) => [e.id, e]),
);

// ─────────────────────────────────────────────
// Default model suggestions per provider
// ─────────────────────────────────────────────

const DEFAULT_MODELS: Record<string, string> = {
  openai: 'gpt-4o',
  anthropic: 'claude-sonnet-4-5',
  gemini: 'gemini-2.5-flash',
  deepseek: 'deepseek-chat',
  groq: 'llama-3.3-70b-versatile',
  cerebras: 'llama3.1-70b',
  perplexity: 'llama-3.1-sonar-large-128k-online',
  xai: 'grok-3',
  moonshot: 'moonshot-v1-128k',
  minimax: 'MiniMax-Text-01',
  cohere: 'command-r-plus',
  azure: 'gpt-4o',
  lmstudio: 'local-model',
  ollama: 'llama3',
  'chatgpt-web': 'text-davinci-002-render-sha',
};

const MODEL_LISTS: Record<string, string[]> = {
  openai: ['gpt-4.1', 'gpt-4.1-mini', 'gpt-4o', 'gpt-4o-mini', 'o3', 'o3-mini', 'o1', 'o1-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
  anthropic: ['claude-opus-4-5', 'claude-sonnet-4-5', 'claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'],
  gemini: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-1.0-pro'],
  deepseek: ['deepseek-chat', 'deepseek-reasoner', 'deepseek-coder'],
  groq: ['llama-3.3-70b-versatile', 'llama-3.1-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768', 'gemma2-9b-it'],
  cerebras: ['llama3.1-70b', 'llama3.1-8b'],
  perplexity: ['llama-3.1-sonar-huge-128k-online', 'llama-3.1-sonar-large-128k-online', 'llama-3.1-sonar-small-128k-online'],
  xai: ['grok-3', 'grok-3-fast', 'grok-2', 'grok-beta'],
  moonshot: ['moonshot-v1-128k', 'moonshot-v1-32k', 'moonshot-v1-8k', 'kimi-latest'],
  minimax: ['MiniMax-Text-01', 'abab6.5s-chat', 'abab6.5-chat'],
  cohere: ['command-r-plus', 'command-r', 'command'],
  azure: ['gpt-4o', 'gpt-4-turbo', 'gpt-35-turbo'],
  ollama: [],
  lmstudio: [],
  'chatgpt-web': ['text-davinci-002-render-sha'],
};

// ─────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────

/**
 * Get an engine instance by its provider ID.
 * Throws if the provider is not registered.
 */
export function getEngine(providerId: string): IEngine {
  const engine = ENGINE_MAP.get(providerId);
  if (!engine) {
    throw new Error(`Provider "${providerId}" is not registered. Available: ${[...ENGINE_MAP.keys()].join(', ')}`);
  }
  return engine;
}

/**
 * Get all registered engine instances.
 */
export function getAllEngines(): IEngine[] {
  return [...ENGINE_INSTANCES];
}

/**
 * Build a full EngineInfo list with runtime configuration status.
 * Checks chrome.storage.local for saved API keys.
 */
export async function listEngines(): Promise<EngineInfo[]> {
  const results = await Promise.all(
    ENGINE_INSTANCES.map(async (engine): Promise<EngineInfo> => {
      const isConfigured = engine.requiresApiKey
        ? await hasKey(engine.id)
        : true;

      return {
        id: engine.id,
        name: engine.name,
        isLocal: engine.isLocal,
        requiresApiKey: engine.requiresApiKey,
        experimental: engine.experimental,
        isConfigured,
        defaultModel: DEFAULT_MODELS[engine.id],
        models: MODEL_LISTS[engine.id],
      };
    }),
  );
  return results;
}

/**
 * Check whether a specific provider is configured (has API key saved).
 */
export async function isEngineConfigured(providerId: string): Promise<boolean> {
  const engine = ENGINE_MAP.get(providerId);
  if (!engine) return false;
  if (!engine.requiresApiKey) return true;
  return hasKey(providerId);
}

/**
 * List only the configured (ready-to-use) engines.
 */
export async function listConfiguredEngines(): Promise<EngineInfo[]> {
  const all = await listEngines();
  return all.filter((e) => e.isConfigured && !e.experimental);
}

/**
 * Check whether a providerId is a known registered engine.
 */
export function isKnownEngine(providerId: string): boolean {
  return ENGINE_MAP.has(providerId);
}
