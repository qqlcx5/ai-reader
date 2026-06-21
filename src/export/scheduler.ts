/**
 * Auto-Backup Scheduler
 *
 * Uses chrome.alarms to schedule periodic full backups to WebDAV/S3.
 * Default: daily at 02:00 AM.
 *
 * Based on design-06-export-sync.md §7.
 */

import type { AutoBackupConfig, ExportConfig, ExportResult } from './types';

const ALARM_NAME = 'ai-reader-auto-backup';

// ─── Public API ──────────────────────────────────────────────────────

export interface BackupDataProvider {
  /** Fetch the data to back up (conversations + messages + settings). */
  getBackupData(): Promise<string>;
  /** Get the full export config. */
  getExportConfig(): Promise<ExportConfig>;
}

/**
 * Schedule the next auto-backup alarm.
 * Call this after settings change or on extension startup.
 */
export async function scheduleAutoBackup(config: AutoBackupConfig): Promise<void> {
  // Clear existing alarm
  await chrome.alarms.clear(ALARM_NAME);

  if (!config.enabled) return;

  const [hour, minute] = config.time.split(':').map(Number);
  const now = new Date();
  const target = new Date();
  target.setHours(hour, minute, 0, 0);

  // If target time has already passed today, schedule for tomorrow
  if (target <= now) {
    target.setDate(target.getDate() + 1);
  }

  const delayInMinutes = Math.max(
    1,
    Math.ceil((target.getTime() - now.getTime()) / 60_000),
  );

  await chrome.alarms.create(ALARM_NAME, { delayInMinutes, periodInMinutes: 24 * 60 });
}

/**
 * Execute the backup immediately (on alarm trigger or manual invocation).
 */
export async function executeBackup(
  provider: BackupDataProvider,
): Promise<ExportResult> {
  const taskId = `auto-backup_${Date.now()}`;

  try {
    const config = await provider.getExportConfig();

    if (!config.autoBackup.enabled) {
      return {
        success: false,
        taskId,
        error: { code: 'BACKUP_SCHEDULE_FAILED', message: 'Auto-backup is disabled' },
      };
    }

    const data = await provider.getBackupData();

    // Currently only WebDAV target is implemented; S3 is future work
    if (config.autoBackup.target === 'webdav' && config.webdav.enabled) {
      // Dynamic import to avoid bundling webdav in every entry
      const { uploadBackup } = await import('./webdav');
      return uploadBackup(config.webdav, data);
    }

    return {
      success: false,
      taskId,
      error: {
        code: 'BACKUP_SCHEDULE_FAILED',
        message: `Backup target "${config.autoBackup.target}" is not configured or implemented`,
      },
    };
  } catch (err) {
    return {
      success: false,
      taskId,
      error: {
        code: 'BACKUP_SCHEDULE_FAILED',
        message: err instanceof Error ? err.message : String(err),
      },
    };
  }
}

/**
 * Register the alarm listener. Call once in the background/service worker.
 */
export function registerBackupAlarmListener(provider: BackupDataProvider): void {
  chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === ALARM_NAME) {
      console.log('[ai-reader] Auto-backup alarm triggered');
      const result = await executeBackup(provider);
      if (result.success) {
        console.log(`[ai-reader] Backup successful: ${result.remotePath}`);
      } else {
        console.error(`[ai-reader] Backup failed: ${result.error?.message}`);
      }
    }
  });
}

/**
 * Get the time remaining until the next backup.
 */
export async function getNextBackupTime(): Promise<Date | null> {
  const alarm = await chrome.alarms.get(ALARM_NAME);
  if (!alarm) return null;
  return new Date(alarm.scheduledTime);
}
