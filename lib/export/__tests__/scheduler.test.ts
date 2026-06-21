import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { computeNextDelay, AUTO_BACKUP_ALARM } from '@/lib/export';

describe('scheduler', () => {
  describe('computeNextDelay', () => {
    it('returns a positive delay when target is in the future today', () => {
      const now = new Date('2026-06-21T01:00:00Z');
      const delay = computeNextDelay(now, 2, 0);
      expect(delay).toBeGreaterThan(0);
    });

    it('rolls over to tomorrow when target has already passed today', () => {
      const now = new Date('2026-06-21T03:00:00Z'); // past 02:00 UTC
      const delay = computeNextDelay(now, 2, 0);
      // From 03:00 to 02:00 next day is 23 hours = 1380 minutes
      expect(delay).toBeGreaterThanOrEqual(23 * 60);
    });

    it('returns at least 1 minute for same-second targets', () => {
      const now = new Date('2026-06-21T02:00:00Z');
      const delay = computeNextDelay(now, 2, 0);
      expect(delay).toBeGreaterThanOrEqual(1);
    });

    it('handles minute granularity', () => {
      const now = new Date('2026-06-21T00:00:00Z');
      const delay = computeNextDelay(now, 0, 30);
      // 30 minutes
      expect(delay).toBeGreaterThanOrEqual(29);
      expect(delay).toBeLessThanOrEqual(31);
    });
  });

  describe('scheduleAutoBackup', () => {
    beforeEach(() => {
      // Stub chrome.alarms
      (globalThis as unknown as { chrome?: unknown }).chrome = {
        alarms: {
          create: vi.fn(async () => undefined),
          clear: vi.fn(async () => true),
        },
      };
    });

    afterEach(() => {
      delete (globalThis as unknown as { chrome?: unknown }).chrome;
    });

    it('clears the alarm when autoBackup is disabled', async () => {
      const { scheduleAutoBackup } = await import('@/lib/export');
      await scheduleAutoBackup({
        format: 'markdown',
        includeApiKeys: false,
        autoBackupEnabled: false,
      });
      const alarms = (
        globalThis as unknown as { chrome: { alarms: { clear: ReturnType<typeof vi.fn> } } }
      ).chrome.alarms;
      expect(alarms.clear).toHaveBeenCalledWith(AUTO_BACKUP_ALARM);
    });

    it('creates the alarm with delayInMinutes when enabled', async () => {
      const { scheduleAutoBackup } = await import('@/lib/export');
      const now = new Date('2026-06-21T01:00:00Z');
      await scheduleAutoBackup(
        { format: 'markdown', includeApiKeys: false, autoBackupEnabled: true },
        { now, hour: 2, minute: 0 },
      );
      const alarms = (
        globalThis as unknown as { chrome: { alarms: { create: ReturnType<typeof vi.fn> } } }
      ).chrome.alarms;
      expect(alarms.create).toHaveBeenCalledWith(
        AUTO_BACKUP_ALARM,
        expect.objectContaining({ delayInMinutes: expect.any(Number) }),
      );
    });

    it('is a no-op when chrome.alarms is unavailable', async () => {
      const fresh = await import('@/lib/export');
      delete (globalThis as unknown as { chrome?: unknown }).chrome;
      await expect(
        fresh.scheduleAutoBackup({
          format: 'markdown',
          includeApiKeys: false,
          autoBackupEnabled: true,
        }),
      ).resolves.toBeUndefined();
    });
  });
});
