/**
 * M3 Provider & LLM Client — Metrics & cost estimation
 */
import type { RequestMetrics, StreamEvent } from './types';

// Price table: $ per 1K tokens (input / output)
const PRICE_TABLE: Record<string, { input: number; output: number }> = {
  'gpt-4o': { input: 0.0025, output: 0.01 },
  'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
  'gpt-4-turbo': { input: 0.01, output: 0.03 },
  'claude-3-5-sonnet': { input: 0.003, output: 0.015 },
  'claude-3-opus': { input: 0.015, output: 0.075 },
  'claude-3-haiku': { input: 0.00025, output: 0.00125 },
  'gemini-1.5-pro': { input: 0.00125, output: 0.005 },
  'gemini-1.5-flash': { input: 0.000075, output: 0.0003 },
};

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

export function updateMetricsOnEvent(
  metrics: RequestMetrics,
  event: StreamEvent
): void {
  if (event.type === 'delta') {
    if (metrics.firstTokenTime === null) {
      metrics.firstTokenTime = Date.now();
    }
  }
  if (event.type === 'done') {
    metrics.endTime = Date.now();
    metrics.totalLatency = metrics.endTime - metrics.startTime;
  }
  if (event.type === 'usage') {
    const totalTokens = event.promptTokens + event.completionTokens;
    if (metrics.endTime && metrics.firstTokenTime) {
      const generationTime = (metrics.endTime - metrics.firstTokenTime) / 1000;
      if (generationTime > 0) {
        metrics.tokensPerSecond = event.completionTokens / generationTime;
      }
    }
    metrics.estimatedCost = estimateCost(metrics.model, event.promptTokens, event.completionTokens);
  }
}

export function estimateCost(model: string, promptTokens: number, completionTokens: number): number {
  // Try exact match
  let price = PRICE_TABLE[model];
  // Try prefix match
  if (!price) {
    for (const [key, val] of Object.entries(PRICE_TABLE)) {
      if (model.includes(key) || key.includes(model)) {
        price = val;
        break;
      }
    }
  }
  if (!price) {
    // Fallback: generic estimate ~$0.001 per 1K tokens
    price = { input: 0.001, output: 0.002 };
  }
  return (promptTokens / 1000) * price.input + (completionTokens / 1000) * price.output;
}

export function roughTokenCount(text: string): number {
  // Rough estimate: ~4 chars per token for CJK, ~4 for English
  return Math.ceil(text.length / 4);
}
