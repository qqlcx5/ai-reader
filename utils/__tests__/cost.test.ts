import { describe, it, expect } from 'vitest';
import { estimateTokens, estimateCost, formatCost } from '@/utils/cost';

describe('estimateTokens', () => {
  it('estimates Chinese text at ~1.5 tokens per char', () => {
    const result = estimateTokens('你好世界'); // 4 Chinese chars
    expect(result).toBe(6); // 4 * 1.5 = 6
  });

  it('estimates English text at ~0.25 tokens per char', () => {
    const result = estimateTokens('hello'); // 5 chars
    expect(result).toBe(2); // 5 * 0.25 = 1.25, ceil → 2
  });

  it('handles mixed Chinese and English text', () => {
    const result = estimateTokens('hello你好');
    // h=0.25, e=0.25, l=0.25, l=0.25, o=0.25, 你=1.5, 好=1.5
    // total = 1.25 + 3 = 4.25, ceil → 5
    expect(result).toBe(5);
  });

  it('returns 0 for empty string', () => {
    expect(estimateTokens('')).toBe(0);
  });
});

describe('estimateCost', () => {
  it('calculates cost for a known model', () => {
    // gpt-4o: input $2.5/1M, output $10/1M
    const cost = estimateCost('gpt-4o', 1_000_000, 1_000_000);
    expect(cost).toBe(12.5);
  });

  it('calculates cost proportionally', () => {
    // gpt-4o-mini: input $0.15/1M, output $0.6/1M
    const cost = estimateCost('gpt-4o-mini', 100_000, 100_000);
    expect(cost).toBeCloseTo(0.075);
  });

  it('returns 0 for unknown model', () => {
    expect(estimateCost('unknown-model', 1000, 1000)).toBe(0);
  });
});

describe('formatCost', () => {
  it('shows "<$0.01" for costs below $0.01', () => {
    expect(formatCost(0.005)).toBe('<$0.01');
  });

  it('shows "<$0.01" for exactly 0', () => {
    expect(formatCost(0)).toBe('<$0.01');
  });

  it('formats cost with two decimal places', () => {
    expect(formatCost(1.5)).toBe('$1.50');
  });

  it('formats larger costs correctly', () => {
    expect(formatCost(12.345)).toBe('$12.35');
  });
});
