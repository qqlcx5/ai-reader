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
import { importBackup, extractBackupFromZip, parseBackupJson } from '@/lib/export/import';
import { pageRepo } from '@/modules/storage/repositories/page.repo';
import type { PageRecord } from '@/modules/storage/types';
import JSZip from 'jszip';

beforeEach(() => {
  resetDbForTests(`test-import-${Math.random()}`);
});

const sampleConversation = {
  id: 'conv-test-001',
  title: 'Test Conv',
  createdAt: 1000,
  updatedAt: 2000,
  mode: 'chat',
  activeProviderIds: [],
  messageCount: 0,
  preview: '',
};

const sampleMessage = {
  id: 'msg-test-001',
  conversationId: 'conv-test-001',
  role: 'user',
  content: 'Hello',
  modelResponses: [],
  createdAt: 1000,
};

const samplePage: PageRecord = {
  id: 'page-test-0001abcd',
  url: 'https://example.com/test',
  title: 'Test Page',
  favicon: '',
  timestamp: 1000,
  content: { rawText: 'Test content', wordCount: 2 },
  conversationId: 'conv-test-001',
};

describe('parseBackupJson', () => {
  it('parses a valid JSON string', () => {
    const json = JSON.stringify({ conversations: [], messages: [] });
    const result = parseBackupJson(json);
    expect(result).toEqual({ conversations: [], messages: [] });
  });

  it('throws for invalid JSON', () => {
    expect(() => parseBackupJson('not json')).toThrow();
  });
});

describe('importBackup with strategy=skip', () => {
  it('imports conversations and messages when DB is empty', async () => {
    const data = {
      conversations: [sampleConversation],
      messages: [sampleMessage],
      pages: [samplePage],
    };
    const stats = await importBackup(data, 'skip');
    expect(stats.conversations.imported).toBe(1);
    expect(stats.conversations.skipped).toBe(0);
    expect(stats.messages.imported).toBe(1);
    expect(stats.pages.imported).toBe(1);
  });

  it('skip strategy does not overwrite existing records', async () => {
    // First import
    const data = {
      conversations: [sampleConversation],
      pages: [samplePage],
    };
    await importBackup(data, 'skip');

    // Second import with modified data
    const modifiedData = {
      conversations: [{ ...sampleConversation, title: 'Modified Title' }],
      pages: [{ ...samplePage, title: 'Modified Page' }],
    };
    const stats = await importBackup(modifiedData, 'skip');
    expect(stats.conversations.skipped).toBe(1);
    expect(stats.conversations.imported).toBe(0);
    expect(stats.pages.skipped).toBe(1);
  });
});

describe('importBackup with strategy=overwrite', () => {
  it('overwrites existing records', async () => {
    // First import
    await importBackup(
      { conversations: [sampleConversation], pages: [samplePage] },
      'skip',
    );

    // Second import with modified data using overwrite
    const modifiedData = {
      conversations: [{ ...sampleConversation, title: 'Overwritten Title' }],
      pages: [{ ...samplePage, title: 'Overwritten Page' }],
    };
    const stats = await importBackup(modifiedData, 'overwrite');
    expect(stats.conversations.imported).toBe(1);
    expect(stats.conversations.skipped).toBe(0);
    expect(stats.pages.imported).toBe(1);
    expect(stats.pages.skipped).toBe(0);

    // Verify the record was actually overwritten
    const page = await pageRepo.findById(samplePage.id);
    expect(page?.title).toBe('Overwritten Page');
  });
});

describe('extractBackupFromZip', () => {
  it('extracts backup.json from a ZIP ArrayBuffer', async () => {
    const content = JSON.stringify({ conversations: [], messages: [], generatedAt: 12345 });
    const zip = new JSZip();
    zip.file('backup.json', content);
    const buffer = await zip.generateAsync({ type: 'arraybuffer' });

    const extracted = await extractBackupFromZip(buffer);
    expect(extracted).toBe(content);
    const parsed = JSON.parse(extracted) as { generatedAt: number };
    expect(parsed.generatedAt).toBe(12345);
  });

  it('throws if ZIP has no backup.json or other files', async () => {
    const emptyZip = new JSZip();
    const buffer = await emptyZip.generateAsync({ type: 'arraybuffer' });
    await expect(extractBackupFromZip(buffer)).rejects.toThrow('ZIP 中未找到 backup.json');
  });

  it('falls back to first file if no backup.json', async () => {
    const content = JSON.stringify({ conversations: [{ id: 'c1' }] });
    const zip = new JSZip();
    zip.file('other-file.json', content);
    const buffer = await zip.generateAsync({ type: 'arraybuffer' });

    const extracted = await extractBackupFromZip(buffer);
    expect(extracted).toBe(content);
  });
});

describe('importBackup edge cases', () => {
  it('throws for null data', async () => {
    await expect(importBackup(null)).rejects.toThrow('无效的备份格式');
  });

  it('handles missing pages array gracefully', async () => {
    const data = { conversations: [sampleConversation] };
    const stats = await importBackup(data, 'skip');
    expect(stats.pages.imported).toBe(0);
    expect(stats.pages.skipped).toBe(0);
  });
});
