import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/db/dexie';
import { exportBackup, importBackup, compressRawHtml, decompressRawHtml } from '@/core/sync/backup-packager';
import type { CapturedDocument } from '@/db/schema';

function makeDoc(id: string): CapturedDocument {
  return {
    id,
    title: `Doc ${id}`,
    url: `https://example.com/${id}`,
    markdownContent: `# Doc ${id}\n\nContent`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

beforeEach(async () => {
  await db.documents.clear();
  await db.chatHistories.clear();
  await db.settings.clear();
});

describe('backup-packager - export', () => {
  it('should export all data', async () => {
    await db.documents.put(makeDoc('d1'));
    await db.documents.put(makeDoc('d2'));

    const backup = await exportBackup();

    expect(backup.schemaVersion).toBe(1);
    expect(backup.documents).toHaveLength(2);
    expect(backup.chatHistories).toBeDefined();
    expect(backup.settings).toBeDefined();
    expect(backup.exportedAt).toBeGreaterThan(0);
    expect(backup.version).toBe('1.0.0');
  });
});

describe('backup-packager - import', () => {
  it('should import valid backup', async () => {
    const backup = {
      schemaVersion: 1,
      documents: [makeDoc('imp1')],
      chatHistories: [],
      settings: [{ key: 'test', value: 'val', updatedAt: Date.now() }],
      exportedAt: Date.now(),
      version: '1.0.0',
    };

    const result = await importBackup(JSON.stringify(backup));
    expect(result.success).toBe(true);

    const docs = await db.documents.toArray();
    expect(docs).toHaveLength(1);
    expect(docs[0].id).toBe('imp1');
  });

  it('should reject invalid JSON', async () => {
    const result = await importBackup('not json');
    expect(result.success).toBe(false);
    expect(result.error).toContain('JSON');
  });

  it('should reject mismatched schema version', async () => {
    const backup = {
      schemaVersion: 999,
      documents: [],
      chatHistories: [],
      settings: [],
      exportedAt: Date.now(),
      version: '1.0.0',
    };

    const result = await importBackup(JSON.stringify(backup));
    expect(result.success).toBe(false);
    expect(result.error).toContain('版本不兼容');
  });
});

describe('lz-string compression', () => {
  it('should compress and decompress roundtrip', () => {
    const original = '<html><body><p>Hello World! 这是一段中文测试内容。</p></body></html>';
    const compressed = compressRawHtml(original);
    const decompressed = decompressRawHtml(compressed);

    expect(decompressed).toBe(original);
    expect(compressed).not.toBe(original);
  });

  it('should handle empty string', () => {
    const compressed = compressRawHtml('');
    const decompressed = decompressRawHtml(compressed);
    expect(decompressed).toBe('');
  });

  it('should handle large content', () => {
    const large = 'A'.repeat(100000);
    const compressed = compressRawHtml(large);
    const decompressed = decompressRawHtml(compressed);
    expect(decompressed).toBe(large);
    // 压缩后应该更小
    expect(compressed.length).toBeLessThan(large.length);
  });
});
