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
import { pageRepo, normalizeUrl, hashUrl } from '@/modules/storage/repositories/page.repo';
import type { PageRecord } from '@/modules/storage/types';

beforeEach(() => {
  resetDbForTests(`test-page-repo-${Math.random()}`);
});

describe('normalizeUrl', () => {
  it('removes utm_source parameter', () => {
    expect(normalizeUrl('https://example.com/article?utm_source=twitter&id=1')).toBe(
      'https://example.com/article?id=1'
    );
  });

  it('removes all tracking parameters', () => {
    const url = 'https://example.com/?utm_source=x&utm_medium=y&utm_campaign=z&fbclid=abc';
    expect(normalizeUrl(url)).toBe('https://example.com/');
  });

  it('removes hash fragment', () => {
    expect(normalizeUrl('https://example.com/page#section')).toBe('https://example.com/page');
  });

  it('returns original string for invalid URL', () => {
    expect(normalizeUrl('not-a-url')).toBe('not-a-url');
  });
});

describe('hashUrl', () => {
  it('returns same id for same URL', async () => {
    const id1 = await hashUrl('https://example.com/page');
    const id2 = await hashUrl('https://example.com/page');
    expect(id1).toBe(id2);
  });

  it('returns different ids for different URLs', async () => {
    const id1 = await hashUrl('https://example.com/page1');
    const id2 = await hashUrl('https://example.com/page2');
    expect(id1).not.toBe(id2);
  });

  it('returns 16-char hex string', async () => {
    const id = await hashUrl('https://example.com/');
    expect(id).toMatch(/^[0-9a-f]{16}$/);
  });

  it('normalizes URL before hashing', async () => {
    const id1 = await hashUrl('https://example.com/page?utm_source=x#section');
    const id2 = await hashUrl('https://example.com/page');
    expect(id1).toBe(id2);
  });
});

describe('pageRepo', () => {
  const makeRecord = (override: Partial<PageRecord> = {}): PageRecord => ({
    id: 'test-id-1234abcd',
    url: 'https://example.com/page',
    title: 'Test Page',
    favicon: '',
    timestamp: Date.now(),
    content: { rawText: 'Hello world', wordCount: 2 },
    conversationId: 'conv-123',
    ...override,
  });

  it('upsert then findById returns the record', async () => {
    const record = makeRecord();
    await pageRepo.upsert(record);
    const found = await pageRepo.findById(record.id);
    expect(found).toBeDefined();
    expect(found?.title).toBe('Test Page');
  });

  it('findByUrl returns the record for the same URL', async () => {
    const url = 'https://example.com/test-find-by-url';
    const id = await hashUrl(url);
    const record = makeRecord({ id, url });
    await pageRepo.upsert(record);
    const found = await pageRepo.findByUrl(url);
    expect(found).toBeDefined();
    expect(found?.url).toBe(url);
  });

  it('findByUrl returns undefined for unknown URL', async () => {
    const found = await pageRepo.findByUrl('https://unknown.com/never-seen');
    expect(found).toBeUndefined();
  });

  it('listRecent returns records in descending timestamp order', async () => {
    await pageRepo.upsert(makeRecord({ id: 'a', url: 'https://a.com', timestamp: 1000 }));
    await pageRepo.upsert(makeRecord({ id: 'b', url: 'https://b.com', timestamp: 3000 }));
    await pageRepo.upsert(makeRecord({ id: 'c', url: 'https://c.com', timestamp: 2000 }));
    const list = await pageRepo.listRecent({ limit: 10 });
    expect(list[0].id).toBe('b');
    expect(list[1].id).toBe('c');
    expect(list[2].id).toBe('a');
  });

  it('upsert overwrites an existing record', async () => {
    const record = makeRecord({ title: 'Original' });
    await pageRepo.upsert(record);
    await pageRepo.upsert({ ...record, title: 'Updated' });
    const found = await pageRepo.findById(record.id);
    expect(found?.title).toBe('Updated');
  });

  it('deleteById removes the record', async () => {
    const record = makeRecord();
    await pageRepo.upsert(record);
    await pageRepo.deleteById(record.id);
    const found = await pageRepo.findById(record.id);
    expect(found).toBeUndefined();
  });
});
