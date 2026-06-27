// ============================================================
// Tests: defuddle Adapter – Timeout Fallback
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Controls mock defuddle behavior. When `timeout` is true, parseAsync
 * returns a promise that never resolves (triggering the 8s timeout).
 */
let mockShouldTimeout = false;

vi.mock('defuddle', () => ({
  default: class MockDefuddle {
    private url: string;
    constructor(_doc: Document, options: { url: string }) {
      this.url = options.url;
    }
    async parseAsync() {
      if (mockShouldTimeout) {
        return new Promise<never>(() => {
          /* never resolves — triggers timeout in extractContent */
        });
      }
      return {
        title: 'Async Title',
        content: '<p>Async content</p>',
        contentHtml: '<p>Async content</p>',
        contentText: 'Async content',
        excerpt: 'Async excerpt...',
        author: 'Async Author',
        siteName: 'Async Site',
        publishedAt: '2025-06-01',
        readingTime: 2,
        url: this.url,
      };
    }
    parse() {
      return {
        title: 'Sync Title',
        content: '<p>Sync content</p>',
        contentHtml: '<p>Sync content</p>',
        contentText: 'Sync content',
        excerpt: 'Sync excerpt...',
        author: 'Sync Author',
        siteName: 'Sync Site',
        publishedAt: '2025-06-01',
        readingTime: 2,
        url: this.url,
      };
    }
  },
}));

import { extractContent } from './defuddle-adapter';

describe('defuddle adapter – timeout fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockShouldTimeout = false;
    document.body.innerHTML = '<p>Test page content</p>';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('should return async extraction result when fast enough', async () => {
    const result = await extractContent(document, 'https://test.com/page');

    expect(result.title).toBe('Async Title');
    expect(result.author).toBe('Async Author');
    expect(result.siteName).toBe('Async Site');
    expect(result.contentHtml).toBe('<p>Async content</p>');
    expect(result.contentText).toBe('Async content');
  });

  it(
    'should fall back to sync parse() on timeout',
    async () => {
      mockShouldTimeout = true;
      const result = await extractContent(document, 'https://test.com/page');

      // Should return sync fallback result
      expect(result.title).toBe('Sync Title');
      expect(result.author).toBe('Sync Author');
      expect(result.siteName).toBe('Sync Site');
      expect(result.contentHtml).toBe('<p>Sync content</p>');
      expect(result.contentText).toBe('Sync content');
    },
    15000,
  );

  it('should normalize missing fields to empty strings', async () => {
    const result = await extractContent(document, 'https://test.com/minimal');

    // All fields should be strings or numbers, never undefined
    expect(typeof result.title).toBe('string');
    expect(typeof result.url).toBe('string');
    expect(typeof result.siteName).toBe('string');
    expect(typeof result.author).toBe('string');
    expect(typeof result.publishedAt).toBe('string');
    expect(typeof result.excerpt).toBe('string');
    expect(typeof result.contentHtml).toBe('string');
    expect(typeof result.contentText).toBe('string');
    expect(typeof result.image).toBe('string');
    expect(typeof result.readingTime).toBe('number');
  });

  it('should return the correct URL', async () => {
    const result = await extractContent(document, 'https://example.com/article/42');
    expect(result.url).toBe('https://example.com/article/42');
  });
});
