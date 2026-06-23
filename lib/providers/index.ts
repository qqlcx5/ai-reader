/**
 * M3 多模型 Provider 客户端 — 统一导出入口
 *
 * 推荐用法：
 *   import { getEngine, listEngines, runWithFailover, saveKey } from '@/lib/providers'
 */

// ── 核心类型 ──────────────────────────────────
export type {
  IEngine,
  Message,
  ChatStreamOptions,
  RequestMetrics,
  ProviderError,
  EngineInfo,
  ProviderConfig,
  ReconnectState,
} from './types';

export {
  EngineError,
  ERR_MISSING_API_KEY,
  ERR_NETWORK,
  ERR_RATE_LIMIT,
  ERR_AUTH,
  ERR_SERVER,
  ERR_PARSE,
  ERR_ABORTED,
  ERR_TIMEOUT,
  ERR_UNKNOWN,
} from './types';

// ── 基类（供扩展开发使用） ─────────────────────
export { BaseEngine } from './base-engine';
export { OpenAICompatibleEngine } from './openai-compatible';

// ── OpenAI-compatible Provider 引擎 ───────────
export {
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

// ── 非兼容 Provider 引擎 ──────────────────────
export { AnthropicEngine } from './anthropic-engine';
export { GeminiEngine } from './gemini-engine';
export { CohereEngine } from './cohere-engine';
export { ChatGPTWebEngine } from './chatgpt-web-engine';

// ── 故障转移链 ────────────────────────────────
export {
  runWithFailover,
  formatFailoverError,
} from './failover-chain';
export type { FailoverEntry, FailoverChainOptions, FailoverResult } from './failover-chain';

// ── Provider 注册表 ───────────────────────────
export {
  getEngine,
  getAllEngines,
  listEngines,
  listConfiguredEngines,
  isEngineConfigured,
  isKnownEngine,
} from './registry';

// ── API Key 安全存储 ───────────────────────────
export {
  saveKey,
  getKey,
  deleteKey,
  hasKey,
  saveProviderConfig,
  getProviderConfig,
  deleteProviderConfig,
  listProviderConfigIds,
  loadAllProviderConfigs,
  saveGlobalProxy,
  getGlobalProxy,
  resolveBaseUrl,
} from './key-store';
export type { GlobalProxyConfig } from './key-store';

// ── 定价表 ────────────────────────────────────
export {
  PRICING_TABLE,
  getModelPrice,
  estimateCost,
} from './pricing';
export type { ModelPrice } from './pricing';
