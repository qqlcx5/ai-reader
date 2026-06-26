import { describe, it, expect } from 'vitest';
import { buildPrompt, truncateContent } from '@/core/chat/prompt-builder';

describe('prompt-builder', () => {
  it('should build prompt with default system prompt', () => {
    const messages = buildPrompt({
      markdownContent: '# Article\n\nContent here',
      question: 'What is this about?',
    });

    expect(messages.length).toBeGreaterThanOrEqual(2);
    expect(messages[0].role).toBe('system');
    expect(messages[0].content).toContain('AI 阅读助手');
    expect(messages[messages.length - 1].role).toBe('user');
    expect(messages[messages.length - 1].content).toContain('What is this about?');
  });

  it('should use model-specific system prompt over global', () => {
    const messages = buildPrompt({
      markdownContent: 'content',
      question: 'question',
      model: {
        id: 'm1',
        name: 'Test',
        provider: 'openai-compatible',
        enabled: true,
        apiKey: '',
        baseUrl: '',
        model: '',
        systemPrompt: 'Model-specific prompt',
        createdAt: 0,
        updatedAt: 0,
      },
      globalSystemPrompt: 'Global prompt',
    });

    expect(messages[0].content).toBe('Model-specific prompt');
  });

  it('should use global prompt when model has no prompt', () => {
    const messages = buildPrompt({
      markdownContent: 'content',
      question: 'question',
      globalSystemPrompt: 'Global prompt',
    });

    expect(messages[0].content).toBe('Global prompt');
  });

  it('should include document content in user message', () => {
    const messages = buildPrompt({
      markdownContent: '# My Article\n\nHello World',
      question: 'Summarize',
    });

    const userMsg = messages[messages.length - 1];
    expect(userMsg.content).toContain('# My Article');
    expect(userMsg.content).toContain('Summarize');
  });

  it('should include history messages', () => {
    const messages = buildPrompt({
      markdownContent: 'content',
      question: 'second question',
      history: [
        { role: 'user', content: 'first question', timestamp: 0 },
        { role: 'assistant', content: 'first answer', timestamp: 0 },
      ],
    });

    // system + 2 history + user = 4
    expect(messages).toHaveLength(4);
    expect(messages[1].role).toBe('user');
    expect(messages[1].content).toBe('first question');
    expect(messages[2].role).toBe('assistant');
    expect(messages[2].content).toBe('first answer');
  });

  it('should replace template variables', () => {
    const messages = buildPrompt({
      markdownContent: 'content',
      question: 'q',
      globalSystemPrompt: 'Title: {{title}}, URL: {{url}}',
      documentTitle: 'Test Page',
      documentUrl: 'https://test.com',
    });

    expect(messages[0].content).toContain('Test Page');
    expect(messages[0].content).toContain('https://test.com');
  });
});

describe('truncateContent', () => {
  it('should not truncate short content', () => {
    const content = 'short text';
    expect(truncateContent(content, 100)).toBe(content);
  });

  it('should truncate long content', () => {
    const content = 'a'.repeat(100);
    const result = truncateContent(content, 50);
    expect(result.length).toBeLessThan(content.length);
    expect(result).toContain('已截断');
  });
});
