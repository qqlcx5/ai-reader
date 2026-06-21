import { describe, expect, it, vi, beforeEach } from 'vitest';
import { performWebDAVBackup, recordBackupSuccess, recordBackupError } from '@/lib/export';
import { WebDAVAuthError } from '@/lib/export';

// We mock the webdav module so the test doesn't need a real server.
vi.mock('@/lib/export/webdav', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/export/webdav')>();
  return {
    ...original,
    createWebDAVClient: vi.fn(() => ({
      putFileContents: vi.fn(async () => undefined),
      stat: vi.fn(async () => undefined),
      createDirectory: vi.fn(async () => undefined),
      getDirectoryContents: vi.fn(async () => []),
    })),
    uploadBackup: vi.fn(async () => '/backups/ai-reader-backup-2026-06-21.json'),
  };
});

vi.mock('@/modules/storage/db', () => ({
  getDb: vi.fn(() => ({
    conversations: {
      toArray: vi.fn(async () => [
        { id: 'c1', title: 'T', mode: 'chat', url: 'u', createdAt: 1, updatedAt: 1 },
      ]),
    },
    messages: {
      orderBy: vi.fn(() => ({
        each: vi.fn(async (_cb: (m: unknown) => void) => {}),
      })),
    },
    settings: {
      get: vi.fn(async () => undefined),
    },
  })),
}));

const settingsState = {
  settings: {
    providers: [{ id: 'p1', name: 'P1', type: 'openai', model: 'gpt-4', enabled: true, apiKey: 'secret' }],
    prompts: [],
    exportConfig: {
      format: 'markdown' as const,
      includeApiKeys: false,
      autoBackupEnabled: true,
      webDAVUrl: 'https://dav',
      webDAVUsername: 'u',
      webDAVPassword: 'p',
      webDAVBackupPath: '/backups',
    },
    rssConfig: { enabled: false, fetchIntervalMinutes: 60, maxItemsPerFeed: 50, aiSummaryEnabled: false },
    ui: { theme: 'light' as const, sidePanelOpen: false, shortcutEnabled: true, activeRoute: '/' },
  },
  setSettings: vi.fn(),
};

vi.mock('@/stores/settings.store', () => ({
  useSettingsStore: vi.fn(() => settingsState),
}));

describe('backup flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('strips api keys from the payload before uploading', async () => {
    const result = await performWebDAVBackup(settingsState.settings.exportConfig);
    const json = JSON.stringify(result.snapshot);
    expect(json).not.toContain('secret');
    // The result snapshot is the SAFE version
    expect(result.snapshot.settings.providers[0].apiKey).toBe('');
  });

  it('returns the remote path returned by uploadBackup', async () => {
    const result = await performWebDAVBackup(settingsState.settings.exportConfig);
    expect(result.remotePath).toBe('/backups/ai-reader-backup-2026-06-21.json');
  });

  it('throws WebDAVAuthError when upload fails with 401', async () => {
    const webdavModule = await import('@/lib/export/webdav');
    (webdavModule.uploadBackup as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new WebDAVAuthError(401),
    );
    await expect(performWebDAVBackup(settingsState.settings.exportConfig)).rejects.toBeInstanceOf(
      WebDAVAuthError,
    );
  });

  it('recordBackupSuccess updates lastBackupAt', async () => {
    await recordBackupSuccess(123);
    expect(settingsState.setSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        exportConfig: expect.objectContaining({ lastBackupAt: 123, lastBackupError: undefined }),
      }),
    );
  });

  it('recordBackupError updates lastBackupError', async () => {
    await recordBackupError('boom');
    expect(settingsState.setSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        exportConfig: expect.objectContaining({ lastBackupError: 'boom' }),
      }),
    );
  });
});
