import { describe, expect, it } from 'vitest';
import { buildMarkdown, buildFrontMatter, formatMessage } from '@/lib/export';
import type { Conversation, Message } from '@/lib/export';

const baseConversation: Conversation = {
  id: 'c1',
  title: 'Demo',
  mode: 'chat',
  url: 'https://example.com/post',
  createdAt: 1_700_000_000_000,
  updatedAt: 1_700_000_000_000,
};

const messages: Message[] = [
  {
    id: 'm1',
    conversationId: 'c1',
    role: 'user',
    content: 'What is the meaning of life?',
    createdAt: 1_700_000_000_000,
  },
  {
    id: 'm2',
    conversationId: 'c1',
    role: 'assistant',
    providerId: 'p1',
    providerName: 'OpenAI',
    model: 'gpt-4',
    content: '42.',
    createdAt: 1_700_000_000_500,
  },
];

describe('markdown', () => {
  describe('buildFrontMatter', () => {
    it('emits YAML front-matter with metadata', () => {
      const fm = buildFrontMatter({
        title: 'Demo',
        conversation: baseConversation,
        messages,
        exportedAt: '2026-06-21T00:00:00.000Z',
      });
      expect(fm).toContain('title: Demo');
      expect(fm).toContain('source: https://example.com/post');
      expect(fm).toContain('mode: chat');
      expect(fm).toContain('messageCount: 2');
      expect(fm.startsWith('---')).toBe(true);
    });

    it('quotes values containing YAML-unsafe characters', () => {
      const fm = buildFrontMatter({
        title: 'with: colon',
        conversation: { ...baseConversation, url: 'https://x.com?q=1&a=2' },
        messages: [],
        exportedAt: '2026-06-21T00:00:00.000Z',
      });
      expect(fm).toContain('title: "with: colon"');
      expect(fm).toContain('source: "https://x.com?q=1&a=2"');
    });
  });

  describe('formatMessage', () => {
    it('uses Q1 / A1 numbering for user / assistant', () => {
      const userQ = formatMessage(messages[0], 0);
      const assistantA = formatMessage(messages[1], 1);
      expect(userQ).toMatch(/^## Q1/);
      expect(assistantA).toMatch(/^## A2/);
    });

    it('includes provider name and model meta for assistant messages', () => {
      const out = formatMessage(messages[1], 0);
      expect(out).toContain('*OpenAI · gpt-4*');
    });

    it('omits meta when provider name is missing', () => {
      const out = formatMessage(messages[0], 0);
      expect(out).not.toContain('*');
    });
  });

  describe('buildMarkdown', () => {
    it('sorts messages by createdAt before formatting', () => {
      const unordered: Message[] = [
        { ...messages[1], createdAt: 2_000 },
        { ...messages[0], createdAt: 1_000 },
      ];
      const md = buildMarkdown({
        title: 'T',
        conversation: baseConversation,
        messages: unordered,
      });
      const q1 = md.indexOf('## Q1');
      const a2 = md.indexOf('## A2');
      expect(q1).toBeLessThan(a2);
    });

    it('separates messages with ---', () => {
      const md = buildMarkdown({
        title: 'T',
        conversation: baseConversation,
        messages,
      });
      expect(md).toContain('\n---\n');
    });

    it('ends with a single trailing newline', () => {
      const md = buildMarkdown({
        title: 'T',
        conversation: baseConversation,
        messages,
      });
      expect(md.endsWith('\n')).toBe(true);
      expect(md.endsWith('\n\n')).toBe(false);
    });
  });
});
