import { openSidePanelAndExtract, broadcastAbort, getActiveTabId, isChromeSidePanelAvailable } from '@/utils/browser';
import { AUTO_BACKUP_ALARM, performWebDAVBackup, recordBackupSuccess, recordBackupError } from '@/lib/export';

export default defineBackground(() => {
  if (typeof browser === 'undefined' || !browser?.runtime) {
    return;
  }

  const runtime = browser.runtime;

  // Enable side panel on action click — also covers the `open-side-panel` command.
  if (isChromeSidePanelAvailable() && browser.action?.onClicked) {
    browser.action.onClicked.addListener(async (tab) => {
      await openSidePanelAndExtract({ tabId: tab?.id });
    });
  }

  // Keyboard command routing.
  if (browser.commands?.onCommand) {
    browser.commands.onCommand.addListener(async (command) => {
      switch (command) {
        case 'open-side-panel': {
          const tabId = await getActiveTabId();
          await openSidePanelAndExtract({ tabId: tabId ?? undefined });
          break;
        }
        case 'toggle-side-panel': {
          // Chrome side panel has no public close() — re-open is the safe action.
          const tabId = await getActiveTabId();
          await openSidePanelAndExtract({ tabId: tabId ?? undefined });
          break;
        }
        case 'abort-all-generations': {
          await broadcastAbort();
          break;
        }
        default:
          // Unknown command: ignore.
          break;
      }
    });
  }

  // M6 — auto-backup alarm handler. Fires once at the scheduled backup
  // time (default 02:00). We read the current ExportConfig, run a full
  // WebDAV backup, persist the outcome, and re-schedule the next run.
  // Single-flight guard prevents overlapping runs if the alarm fires
  // twice (e.g. after device wake).
  if (browser.alarms?.onAlarm) {
    let backupInFlight = false;
    browser.alarms.onAlarm.addListener(async (alarm) => {
      if (alarm?.name !== AUTO_BACKUP_ALARM) return;
      if (backupInFlight) return;
      backupInFlight = true;
      try {
        const { useSettingsStore } = await import('@/stores/settings.store');
        const store = useSettingsStore();
        const config = store.settings.exportConfig;
        if (!config.autoBackupEnabled) return;
        const result = await performWebDAVBackup(config);
        await recordBackupSuccess(Date.now());
        if (process.env.NODE_ENV !== 'production') {
          // eslint-disable-next-line no-console
          console.debug('[background] auto-backup done', result.remotePath);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await recordBackupError(message);
        if (process.env.NODE_ENV !== 'production') {
          // eslint-disable-next-line no-console
          console.warn('[background] auto-backup failed', message);
        }
      } finally {
        backupInFlight = false;
        // Re-arm the alarm for the next cycle (one-shot alarm model).
        try {
          const { scheduleAutoBackup } = await import('@/lib/export');
          const { useSettingsStore } = await import('@/stores/settings.store');
          await scheduleAutoBackup(useSettingsStore().settings.exportConfig);
        } catch {
          // best-effort re-schedule
        }
      }
    });
  }

  // Cross-entry runtime messages — fan out as a no-op aggregator.
  runtime.onMessage?.addListener((message) => {
    if (!message || typeof message !== 'object' || !('type' in message)) return;
    // The command-bus is already wired inside the UI entrypoints; we don't
    // need to re-broadcast, but logging aids debugging.
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.debug('[background] message', message);
    }
  });
});
