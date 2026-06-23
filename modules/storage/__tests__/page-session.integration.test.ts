import { describe, it, expect, beforeEach } from 'vitest';
import { webcrypto } from 'crypto';

// Polyfill crypto.subtle for jsdom (property is read-only in jsdom, use defineProperty)
if (!globalThis.crypto?.subtle) {
  Object.defineProperty(globalThis, 'crypto', {
    value: webcrypto,
    writable: true,
    configurable: true,
  });
}

// Use fake-indexeddb for Dexie in jsdom
import 'fake-indexeddb/auto';
import { resetDbForTests } from '@/modules/storage/db';
import { normalizeUrl } from '@/modules/storage/repositories/page.repo';
import { getOrCreateSession, updatePageContent } from '@/utils/page-session';

beforeEach(() => {
  resetDbForTests(`test-session-${Math.random()}`);
});

describe('normalizeUrl', () => {
  it('removes utm_source parameter', () => {
    expect(normalizeUrl('https://example.com/article?utm_source=twitter')).toBe(
      'https://example.com/article'
    );
  });

  it('removes hash fragment', () => {
    expect(normalizeUrl('https://example.com/page#section')).toBe('https://example.com/page');
  });
});

describe('getOrCreateSession', () => {
  it('same URL twice returns same conversationId', async () => {
    const url = 'https://example.com/article-1';
    const result1 = await getOrCreateSession(url, 'Article 1');
    const result2 = await getOrCreateSession(url, 'Article 1');
    expect(result1.conversationId).toBe(result2.conversationId);
    expect(result2.isNew).toBe(false);
  });

  it('different URLs return different conversationIds', async () => {
    const result1 = await getOrCreateSession('https://example.com/page-a', 'Page A');
    const result2 = await getOrCreateSession('https://example.com/page-b', 'Page B');
    expect(result1.conversationId).not.toBe(result2.conversationId);
  });

  it('first call isNew=true, second call isNew=false', async () => {
    const url = 'https://example.com/new-page';
    const first = await getOrCreateSession(url, 'New Page');
    expect(first.isNew).toBe(true);
    const second = await getOrCreateSession(url, 'New Page');
    expect(second.isNew).toBe(false);
  });

  it('second call returns existingContent from first session', async () => {
    const url = 'https://example.com/content-page';
    const first = await getOrCreateSession(url, 'Content Page');
    // Update content for the first session
    await updatePageContent(first.pageId, 'Hello world content');
    // Second session should have existingContent
    const second = await getOrCreateSession(url, 'Content Page');
    expect(second.existingContent?.rawText).toBe('Hello world content');
  });

  it('normalizes URL before creating session', async () => {
    const urlWithTracking = 'https://example.com/page?utm_source=twitter#section';
    const urlClean = 'https://example.com/page';
    const result1 = await getOrCreateSession(urlWithTracking, 'Page');
    const result2 = await getOrCreateSession(urlClean, 'Page');
    expect(result1.conversationId).toBe(result2.conversationId);
  });
});

describe('updatePageContent', () => {
  it('updates rawText and wordCount correctly', async () => {
    const url = 'https://example.com/update-test';
    const session = await getOrCreateSession(url, 'Update Test');
    await updatePageContent(session.pageId, 'Hello world 你好');
    // Re-create session to see updated content
    const session2 = await getOrCreateSession(url, 'Update Test');
    expect(session2.existingContent?.rawText).toBe('Hello world 你好');
    // 'Hello' + 'world' = 2 english words, '你' + '好' = 2 CJK
    expect(session2.existingContent?.wordCount).toBe(4);
  });

  it('does nothing for unknown pageId', async () => {
    await expect(updatePageContent('nonexistent-id', 'text')).resolves.toBeUndefined();
  });
});
