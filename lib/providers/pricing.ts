/**
 * M3 多模型 Provider 客户端 — 定价表
 *
 * 价格单位：USD / 1K tokens
 * 来源：各厂商官方定价页（2024-Q4）
 * 注：仅用于前端费用估算，不作为账单依据。
 */

export interface ModelPrice {
  /** Input (prompt) price per 1K tokens in USD */
  input: number;
  /** Output (completion) price per 1K tokens in USD */
  output: number;
  /** Whether discounted cached tokens are available */
  cacheSupport?: boolean;
  /** Cache read price per 1K tokens (typically ~10% of input) */
  cacheInput?: number;
}

/** Complete pricing table keyed by model name / prefix */
export const PRICING_TABLE: Record<string, ModelPrice> = {
  // ── OpenAI ──────────────────────────────────
  'gpt-4o': { input: 0.0025, output: 0.01, cacheSupport: true, cacheInput: 0.00125 },
  'gpt-4o-mini': { input: 0.00015, output: 0.0006, cacheSupport: true, cacheInput: 0.000075 },
  'gpt-4o-2024-11-20': { input: 0.0025, output: 0.01 },
  'gpt-4-turbo': { input: 0.01, output: 0.03 },
  'gpt-4': { input: 0.03, output: 0.06 },
  'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },
  'gpt-4.1': { input: 0.002, output: 0.008 },
  'gpt-4.1-mini': { input: 0.0004, output: 0.0016 },
  'o1': { input: 0.015, output: 0.06 },
  'o1-mini': { input: 0.003, output: 0.012 },
  'o3': { input: 0.01, output: 0.04 },
  'o3-mini': { input: 0.0011, output: 0.0044 },

  // ── Anthropic ───────────────────────────────
  'claude-opus-4': { input: 0.015, output: 0.075, cacheSupport: true, cacheInput: 0.0015 },
  'claude-sonnet-4': { input: 0.003, output: 0.015, cacheSupport: true, cacheInput: 0.0003 },
  'claude-3-5-sonnet': { input: 0.003, output: 0.015, cacheSupport: true, cacheInput: 0.0003 },
  'claude-3-5-haiku': { input: 0.00025, output: 0.00125 },
  'claude-3-opus': { input: 0.015, output: 0.075 },
  'claude-3-haiku': { input: 0.00025, output: 0.00125 },
  'claude-3-sonnet': { input: 0.003, output: 0.015 },

  // ── Google Gemini ────────────────────────────
  'gemini-2.5-pro': { input: 0.00125, output: 0.01 },
  'gemini-2.5-flash': { input: 0.000075, output: 0.0003 },
  'gemini-1.5-pro': { input: 0.00125, output: 0.005 },
  'gemini-1.5-flash': { input: 0.000075, output: 0.0003 },
  'gemini-1.0-pro': { input: 0.0005, output: 0.0015 },

  // ── DeepSeek ────────────────────────────────
  'deepseek-chat': { input: 0.00014, output: 0.00028 },
  'deepseek-reasoner': { input: 0.00055, output: 0.00219 },
  'deepseek-coder': { input: 0.00014, output: 0.00028 },

  // ── Groq ────────────────────────────────────
  'llama-3.3-70b-versatile': { input: 0.00059, output: 0.00079 },
  'llama-3.1-70b-versatile': { input: 0.00059, output: 0.00079 },
  'llama-3.1-8b-instant': { input: 0.00005, output: 0.00008 },
  'mixtral-8x7b-32768': { input: 0.00024, output: 0.00024 },
  'gemma2-9b-it': { input: 0.0002, output: 0.0002 },

  // ── Cerebras ────────────────────────────────
  'llama3.1-70b': { input: 0.0006, output: 0.0006 },
  'llama3.1-8b': { input: 0.0001, output: 0.0001 },

  // ── Perplexity ───────────────────────────────
  'llama-3.1-sonar-huge-128k-online': { input: 0.005, output: 0.005 },
  'llama-3.1-sonar-large-128k-online': { input: 0.001, output: 0.001 },
  'llama-3.1-sonar-small-128k-online': { input: 0.0002, output: 0.0002 },
  'llama-3.1-sonar-large-128k-chat': { input: 0.001, output: 0.001 },

  // ── xAI (Grok) ───────────────────────────────
  'grok-3': { input: 0.003, output: 0.015 },
  'grok-3-fast': { input: 0.005, output: 0.025 },
  'grok-2': { input: 0.002, output: 0.01 },
  'grok-2-vision': { input: 0.002, output: 0.01 },
  'grok-beta': { input: 0.005, output: 0.015 },

  // ── MiniMax ──────────────────────────────────
  'abab6.5s-chat': { input: 0.0001, output: 0.0001 },
  'abab6.5-chat': { input: 0.00045, output: 0.00045 },
  'MiniMax-Text-01': { input: 0.00028, output: 0.00028 },

  // ── Moonshot (Kimi) ──────────────────────────
  'moonshot-v1-8k': { input: 0.00012, output: 0.00012 },
  'moonshot-v1-32k': { input: 0.00024, output: 0.00024 },
  'moonshot-v1-128k': { input: 0.00060, output: 0.00060 },
  'kimi-latest': { input: 0.00060, output: 0.00060 },

  // ── Cohere ───────────────────────────────────
  'command-r-plus': { input: 0.003, output: 0.015 },
  'command-r': { input: 0.0005, output: 0.0015 },
  'command': { input: 0.001, output: 0.002 },

  // ── Local models (free) ───────────────────────
  'ollama': { input: 0, output: 0 },
  'lmstudio': { input: 0, output: 0 },
};

/**
 * Look up the price for a model by exact match or prefix/substring match.
 * Returns a default fallback price when the model is not found.
 */
export function getModelPrice(model: string): ModelPrice {
  if (!model) return { input: 0.001, output: 0.002 };

  const key = model.toLowerCase();

  // Exact match
  const exact = PRICING_TABLE[key] ?? PRICING_TABLE[model];
  if (exact) return exact;

  // Prefix / substring match — find the longest matching key
  let bestMatch: ModelPrice | undefined;
  let bestMatchLen = 0;
  for (const [tableKey, price] of Object.entries(PRICING_TABLE)) {
    const lowerKey = tableKey.toLowerCase();
    if (key.includes(lowerKey) || lowerKey.includes(key)) {
      if (tableKey.length > bestMatchLen) {
        bestMatchLen = tableKey.length;
        bestMatch = price;
      }
    }
  }

  return bestMatch ?? { input: 0.001, output: 0.002 };
}

/**
 * Estimate the USD cost for a request.
 */
export function estimateCost(
  model: string,
  promptTokens: number,
  completionTokens: number,
  cached = false,
): number {
  const price = getModelPrice(model);
  const inputRate = cached && price.cacheInput != null ? price.cacheInput : price.input;
  return (promptTokens / 1000) * inputRate + (completionTokens / 1000) * price.output;
}
