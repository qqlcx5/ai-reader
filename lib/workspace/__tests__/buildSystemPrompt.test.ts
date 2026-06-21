import { describe, it, expect } from 'vitest';
import { buildSystemPrompt, buildHistoryMessages } from '../buildSystemPrompt';
import type { ExtractedContext } from '@/modules/extraction';
import type { Conversation } from '../types';

describe('buildSystemPrompt', () => {
  it('returns default system prompt when context is null', () => {
    const sys = buildSystemPrompt(null);
    expect(sys).toBeDefined();
    expect(sys).toContain('多模型对比工作区');
  });

  it('appends page context block when context is provided', () => {
    const ctx: ExtractedContext = {
      url: 'https://example.com/post/1',
      title: '示例文章',
      siteName: 'Example',
      extractedAt: 1700000000000,
      wordCount: 1234,
      content: '这是正文内容',
      format: 'markdown',
      extractor: 'readability',
    };
    const sys = buildSystemPrompt(ctx) || '';
    expect(sys).toContain('当前页面');
    expect(sys).toContain('示例文章');
    expect(sys).toContain('https://example.com/post/1');
    expect(sys).toContain('1234');
    expect(sys).toContain('这是正文内容');
  });
});

describe('buildHistoryMessages', () => {
  const conv: Conversation = {
    id: 'c1',
    title: '测试',
    createdAt: 0,
    updatedAt: 0,
    activeProviderIds: ['p1'],
    mode: 'chat',
  };

  it('produces at least a system + user message even with empty history', () => {
    const msgs = buildHistoryMessages(conv, { role: 'user', content: '你好' }, [], null);
    expect(msgs.length).toBeGreaterThanOrEqual(2);
    expect(msgs[0].role).toBe('system');
    expect(msgs[msgs.length - 1].role).toBe('user');
  });

  it('preserves history order and ends with user message', () => {
    const history = [
      { role: 'user' as const, content: '问题1' },
      { role: 'assistant' as const, content: '回答1' },
      { role: 'user' as const, content: '问题2' },
      { role: 'assistant' as const, content: '回答2' },
    ];
    const msgs = buildHistoryMessages(conv, { role: 'user', content: '问题3' }, history, null);
    expect(msgs[0].role).toBe('system');
    expect(msgs[msgs.length - 1].role).toBe('user');
    expect(msgs[msgs.length - 1].content).toBe('问题3');
    expect(msgs.length).toBe(6);
  });

  it('skips empty content messages', () => {
    const history = [
      { role: 'user' as const, content: '' },
      { role: 'assistant' as const, content: 'A' },
    ];
    const msgs = buildHistoryMessages(conv, { role: 'user', content: 'Q' }, history, null);
    expect(msgs.length).toBe(3);
    expect(msgs[1].content).toBe('A');
  });

  it('adds fallback user message if last message is not user', () => {
    const history = [{ role: 'assistant' as const, content: 'A' }];
    const msgs = buildHistoryMessages(conv, { role: 'assistant' as const, content: 'B' }, history, null);
    expect(msgs[msgs.length - 1].role).toBe('user');
  });
});
