import { describe, expect, it, vi, beforeEach } from 'vitest';
import { joinPath, ensureDir, uploadNote, uploadBackup, type WebDAVClient } from '@/lib/export';
import { WebDAVAuthError } from '@/lib/export';

function makeMockClient(): WebDAVClient & {
  putFileContents: ReturnType<typeof vi.fn>;
  stat: ReturnType<typeof vi.fn>;
  createDirectory: ReturnType<typeof vi.fn>;
} {
  return {
    putFileContents: vi.fn(async () => undefined),
    stat: vi.fn(async () => undefined),
    createDirectory: vi.fn(async () => undefined),
    getDirectoryContents: vi.fn(async () => []),
  };
}

describe('webdav utilities', () => {
  describe('joinPath', () => {
    it('joins parts with single slashes and preserves leading slash', () => {
      expect(joinPath('/a', 'b', 'c')).toBe('/a/b/c');
    });
    it('skips empty parts', () => {
      expect(joinPath('/a', '', 'b')).toBe('/a/b');
    });
    it('collapses multiple slashes', () => {
      expect(joinPath('/a/', '/b/', '/c')).toBe('/a/b/c');
    });
  });

  describe('ensureDir', () => {
    it('creates each missing segment', async () => {
      const client = makeMockClient();
      client.stat.mockRejectedValue(new Error('404'));
      await ensureDir(client, '/ai-reader/2026-06-21');
      expect(client.createDirectory).toHaveBeenCalledWith('/ai-reader');
      expect(client.createDirectory).toHaveBeenCalledWith('/ai-reader/2026-06-21');
    });

    it('skips existing segments', async () => {
      const client = makeMockClient();
      client.stat.mockResolvedValue(undefined);
      await ensureDir(client, '/a/b');
      expect(client.createDirectory).not.toHaveBeenCalled();
    });

    it('tolerates 405 already-exists errors', async () => {
      const client = makeMockClient();
      client.stat.mockRejectedValue(new Error('404'));
      client.createDirectory.mockRejectedValueOnce(
        Object.assign(new Error('already exists'), { status: 405 }),
      );
      await expect(ensureDir(client, '/a/b')).resolves.toBeUndefined();
    });

    it('maps 401 errors to WebDAVAuthError', async () => {
      const client = makeMockClient();
      client.stat.mockRejectedValue(new Error('404'));
      client.createDirectory.mockRejectedValueOnce(
        Object.assign(new Error('unauth'), { status: 401 }),
      );
      await expect(ensureDir(client, '/a')).rejects.toBeInstanceOf(WebDAVAuthError);
    });
  });

  describe('uploadNote', () => {
    it('uploads to backupPath/yyyy-mm-dd/filename', async () => {
      const client = makeMockClient();
      client.stat.mockResolvedValue(undefined);
      const path = await uploadNote(
        client,
        { url: 'https://dav', username: 'u', password: 'p', backupPath: '/notes' },
        'note.md',
        '# hi',
      );
      expect(path).toBe(`/notes/${new Date().toISOString().split('T')[0]}/note.md`);
      expect(client.putFileContents).toHaveBeenCalledWith(
        path,
        '# hi',
        { overwrite: true },
      );
    });
  });

  describe('uploadBackup', () => {
    it('uploads JSON to backupPath/ai-reader-backup-DATE.json', async () => {
      const client = makeMockClient();
      const path = await uploadBackup(
        client,
        { url: 'https://dav', username: 'u', password: 'p', backupPath: '/backups' },
        '{}',
      );
      expect(path).toMatch(/^\/backups\/ai-reader-backup-\d{4}-\d{2}-\d{2}\.json$/);
      expect(client.putFileContents).toHaveBeenCalledWith(
        path,
        '{}',
        { overwrite: true },
      );
    });

    it('uses root path when backupPath is empty', async () => {
      const client = makeMockClient();
      const path = await uploadBackup(
        client,
        { url: 'https://dav', username: 'u', password: 'p', backupPath: '' },
        '{}',
      );
      expect(path).toMatch(/^ai-reader-backup-\d{4}-\d{2}-\d{2}\.json$/);
    });
  });
});
