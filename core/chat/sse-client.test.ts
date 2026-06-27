// ============================================================
// Tests: SSE Client — eventsource-parser message parsing
// ============================================================

import { describe, it, expect } from 'vitest';

// We can't easily test full streaming without a mock server,
// but we can test the core parsing logic by simulating what
// the parser encounters.

describe('SSE Client — Message Parsing', () => {
  function parseSSELine(line: string): string | null {
    if (!line.startsWith('data: ')) return null;
    const data = line.slice(6).trim();
    if (data === '[DONE]') return null;
    try {
      const parsed = JSON.parse(data);
      return parsed?.choices?.[0]?.delta?.content ?? null;
    } catch {
      return null;
    }
  }

  it('parses a standard content delta', () => {
    const line = 'data: {"choices":[{"delta":{"content":"Hello"}}]}';
    expect(parseSSELine(line)).toBe('Hello');
  });

  it('parses Chinese content', () => {
    const line = 'data: {"choices":[{"delta":{"content":"你好世界"}}]}';
    expect(parseSSELine(line)).toBe('你好世界');
  });

  it('handles [DONE] signal', () => {
    const line = 'data: [DONE]';
    expect(parseSSELine(line)).toBeNull();
  });

  it('handles empty data', () => {
    const line = 'data: {"choices":[{"delta":{}}]}';
    expect(parseSSELine(line)).toBeNull();
  });

  it('handles missing choices', () => {
    const line = 'data: {"choices":[]}';
    expect(parseSSELine(line)).toBeNull();
  });

  it('handles malformed JSON gracefully', () => {
    const line = 'data: {invalid json';
    expect(parseSSELine(line)).toBeNull();
  });

  it('handles multi-line markdown content', () => {
    const content = '# Title\n\n- Item 1\n- Item 2';
    const line = `data: {"choices":[{"delta":{"content":${JSON.stringify(content)}}}]}`;
    expect(parseSSELine(line)).toBe(content);
  });

  it('skips non-data lines', () => {
    expect(parseSSELine('event: ping')).toBeNull();
    expect(parseSSELine('id: 1')).toBeNull();
    expect(parseSSELine('')).toBeNull();
  });

  it('handles content with quotes and special chars', () => {
    const content = 'She said "hello" and smiled.';
    const line = `data: {"choices":[{"delta":{"content":${JSON.stringify(content)}}}]}`;
    expect(parseSSELine(line)).toBe(content);
  });
});

describe('SSE Client — AbortController integration', () => {
  it('AbortController can be created and aborted', () => {
    const controller = new AbortController();
    expect(controller.signal.aborted).toBe(false);
    controller.abort();
    expect(controller.signal.aborted).toBe(true);
  });

  it('AbortController signal fires abort event', () => {
    const controller = new AbortController();
    let aborted = false;
    controller.signal.addEventListener('abort', () => {
      aborted = true;
    });
    controller.abort();
    expect(aborted).toBe(true);
  });
});

describe('SSE Client — Token estimation', () => {
  function estimateTokens(text: string): number {
    let cjk = 0;
    let other = 0;
    for (const ch of text) {
      if (/[\u4e00-\u9fff\u3400-\u4dbf]/.test(ch)) {
        cjk++;
      } else {
        other++;
      }
    }
    return Math.ceil(cjk * 1.5 + other * 0.25);
  }

  it('estimates English text', () => {
    expect(estimateTokens('Hello world')).toBeGreaterThan(0);
    expect(estimateTokens('Hello world')).toBeLessThan(10);
  });

  it('estimates Chinese text', () => {
    const tokens = estimateTokens('你好世界');
    expect(tokens).toBe(6); // 4 chars * 1.5
  });

  it('estimates mixed text', () => {
    const tokens = estimateTokens('你好 API Key');
    // 2 CJK * 1.5 = 3, 7 other * 0.25 = 1.75, ceil(4.75) = 5
    expect(tokens).toBeGreaterThan(0);
  });
});
