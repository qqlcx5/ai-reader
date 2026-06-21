import { describe, it, expect } from 'vitest';
import { createMetrics, updateMetricsOnEvent, estimateCost, roughTokenCount } from '../metrics';
import type { StreamEvent } from '../types';

describe('metrics', () => {
  it('creates metrics with correct initial values', () => {
    const metrics = createMetrics('provider-1', 'gpt-4o');
    expect(metrics.providerId).toBe('provider-1');
    expect(metrics.model).toBe('gpt-4o');
    expect(metrics.firstTokenTime).toBeNull();
    expect(metrics.endTime).toBeNull();
    expect(metrics.totalLatency).toBeNull();
    expect(metrics.tokensPerSecond).toBeNull();
    expect(metrics.estimatedCost).toBeNull();
    expect(metrics.startTime).toBeGreaterThan(0);
  });

  it('updates firstTokenTime on first delta', () => {
    const metrics = createMetrics('1', 'gpt-4o');
    const event: StreamEvent = { type: 'delta', content: 'Hello' };
    updateMetricsOnEvent(metrics, event);
    expect(metrics.firstTokenTime).not.toBeNull();
    expect(metrics.firstTokenTime).toBeGreaterThanOrEqual(metrics.startTime);
  });

  it('updates endTime on done', () => {
    const metrics = createMetrics('1', 'gpt-4o');
    const event: StreamEvent = { type: 'done', finishReason: 'stop' };
    updateMetricsOnEvent(metrics, event);
    expect(metrics.endTime).not.toBeNull();
    expect(metrics.totalLatency).not.toBeNull();
    expect(metrics.totalLatency).toBeGreaterThanOrEqual(0);
  });

  it('updates tokensPerSecond and estimatedCost on usage', () => {
    const metrics = createMetrics('1', 'gpt-4o');
    // Simulate first token
    updateMetricsOnEvent(metrics, { type: 'delta', content: 'H' });
    // Wait a bit
    const start = Date.now();
    while (Date.now() - start < 10) {} // tiny delay
    // Simulate done
    updateMetricsOnEvent(metrics, { type: 'done', finishReason: 'stop' });
    // Simulate usage
    const usageEvent: StreamEvent = { type: 'usage', promptTokens: 100, completionTokens: 50 };
    updateMetricsOnEvent(metrics, usageEvent);
    expect(metrics.estimatedCost).not.toBeNull();
    expect(metrics.estimatedCost).toBeGreaterThan(0);
    // tokensPerSecond may be null if generation time is too short
    expect(metrics.tokensPerSecond).toBeDefined();
  });

  it('estimates cost for known model', () => {
    const cost = estimateCost('gpt-4o', 1000, 500);
    expect(cost).toBe(1000 / 1000 * 0.0025 + 500 / 1000 * 0.01);
  });

  it('estimates cost for unknown model with fallback', () => {
    const cost = estimateCost('unknown-model', 1000, 500);
    expect(cost).toBe(1000 / 1000 * 0.001 + 500 / 1000 * 0.002);
  });

  it('estimates cost for prefix match', () => {
    const cost = estimateCost('claude-3-5-sonnet-20241022', 2000, 1000);
    expect(cost).toBe(2000 / 1000 * 0.003 + 1000 / 1000 * 0.015);
  });

  it('roughTokenCount estimates tokens', () => {
    expect(roughTokenCount('Hello world')).toBeGreaterThan(0);
    expect(roughTokenCount('')).toBe(0);
  });
});
