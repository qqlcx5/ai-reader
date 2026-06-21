/**
 * Metrics & Cost Estimation
 *
 * Tracks per-request performance metrics (TTFT, tokens/s, latency) and
 * estimates cost based on a provider/model price table.
 */

import type { RequestMetrics, StreamEvent } from './types';

// ─── Price Table ($ per 1K tokens) ────────────────────────────────────

interface PriceEntry {
  input: number;
  output: number;
}

const PRICE_TABLE: Record<string, PriceEntry> = {
  // OpenAI
  'gpt-5.1':      { input: 0.00125, output: 0.01 },
  'gpt-5':        { input: 0.00125, output: 0.01 },
  'gpt-4.1':      { input: 0.002,   output: 0.008 },
  'gpt-4o':       { input: 0.0025,  output: 0.01 },
  'gpt-4o-mini':  { input: 0.00015, output: 0.0006 },
  'gpt-4-turbo':  { input: 0.01,    output: 0.03 },
  'o4-mini':      { input: 0.0011,  output: 0.0044 },
  'o3':           { input: 0.01,    output: 0.04 },
  'o3-mini':      { input: 0.0011,  output: 0.0044 },
  // Anthropic
  'claude-opus-4':    { input: 0.015, output: 0.075 },
  'claude-sonnet-4':  { input: 0.003, output: 0.015 },
  'claude-haiku-4.5': { input: 0.0008, output: 0.004 },
  'claude-3-5-sonnet': { input: 0.003, output: 0.015 },
  'claude-3-5-haiku':  { input: 0.0008, output: 0.004 },
  // Google
  'gemini-2.5-pro':  { input: 0.00125, output: 0.01 },
  'gemini-2.5-flash': { input: 0.00015, output: 0.0006 },
  'gemini-1.5-pro':  { input: 0.00125, output: 0.005 },
  'gemini-1.5-flash': { input: 0.000075, output: 0.0003 },
  // DeepSeek
  'deepseek-chat':    { input: 0.00027, output: 0.0011 },
  'deepseek-reasoner': { input: 0.00055, output: 0.00219 },
};

const FALLBACK_PRICE: PriceEntry = { input: 0.001, output: 0.002 };

// ─── Create / Update ──────────────────────────────────────────────────

export function createMetrics(providerId: string, model: string): RequestMetrics {
  return {
    providerId,
    model,
    startTime: Date.now(),
    firstTokenTime: null,
    endTime: null,
    totalLatency: null,
    tokensPerSecond: null,
    estimatedCost: null,
  };
}

export function updateMetricsOnEvent(metrics: RequestMetrics, event: StreamEvent): void {
  switch (event.type) {
    case 'delta':
      if (metrics.firstTokenTime === null) {
        metrics.firstTokenTime = Date.now();
      }
      break;

    case 'done':
      metrics.endTime = Date.now();
      metrics.totalLatency = metrics.endTime - metrics.startTime;
      break;

    case 'usage':
      metrics.estimatedCost = estimateCost(
        metrics.model,
        event.promptTokens,
        event.completionTokens,
      );
      if (metrics.firstTokenTime && metrics.endTime) {
        const generationTime = (metrics.endTime - metrics.firstTokenTime) / 1000;
        if (generationTime > 0 && event.completionTokens > 0) {
          metrics.tokensPerSecond = event.completionTokens / generationTime;
        }
      }
      break;
  }
}

// ─── Cost Estimation ──────────────────────────────────────────────────

export function estimateCost(
  model: string,
  promptTokens: number,
  completionTokens: number,
): number {
  const modelLower = model.toLowerCase();
  let price: PriceEntry | undefined;

  // Exact match
  price = PRICE_TABLE[modelLower];

  // Prefix match (e.g. "gpt-4o-2024-08-06" matches "gpt-4o")
  if (!price) {
    for (const [key, val] of Object.entries(PRICE_TABLE)) {
      if (modelLower.startsWith(key) || key.startsWith(modelLower)) {
        price = val;
        break;
      }
    }
  }

  price = price ?? FALLBACK_PRICE;
  return (promptTokens / 1000) * price.input + (completionTokens / 1000) * price.output;
}

// ─── Rough Token Counting ─────────────────────────────────────────────

/**
 * Rough estimate of token count from string length.
 * CJK: ~1.5 chars/token. English: ~4 chars/token.
 */
export function roughTokenCount(text: string): number {
  let charCount = 0;
  let cjkCount = 0;

  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    if (
      (code >= 0x4e00 && code <= 0x9fff) || // CJK Unified
      (code >= 0x3400 && code <= 0x4dbf) || // CJK Ext-A
      (code >= 0x3040 && code <= 0x309f) || // Hiragana
      (code >= 0x30a0 && code <= 0x30ff) || // Katakana
      (code >= 0xac00 && code <= 0xd7af)     // Hangul
    ) {
      cjkCount++;
    } else {
      charCount++;
    }
  }

  return Math.ceil(cjkCount / 1.5 + charCount / 4);
}
