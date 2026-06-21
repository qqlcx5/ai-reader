import { openSidePanel, broadcastAbort, getActiveTabId, isChromeSidePanelAvailable } from '@/utils/browser';
import { AUTO_BACKUP_ALARM, performWebDAVBackup, recordBackupSuccess, recordBackupError } from '@/lib/export';
import { extractFromTab } from '@/modules/extraction/tab-extractor';

async function triggerExtraction(tabId: number | undefined) {
  if (!tabId) return;
  await openSidePanel({ tabId });
  await new Promise((r) => setTimeout(r, 200));
  await extractFromTab(tabId);
}

export default defineBackground(() => {
  if (typeof browser === 'undefined' || !browser?.runtime) return;

  const runtime = browser.runtime;

  if (isChromeSidePanelAvailable() && browser.action?.onClicked) {
    browser.action.onClicked.addListener(async (tab) => {
      await triggerExtraction(tab?.id);
    });
  }

  if (browser.commands?.onCommand) {
    browser.commands.onCommand.addListener(async (command) => {
      switch (command) {
        case 'open-side-panel':
        case 'toggle-side-panel': {
          const tabId = await getActiveTabId();
          await triggerExtraction(tabId ?? undefined);
          break;
        }
        case 'abort-all-generations': {
          await broadcastAbort();
          break;
        }
      }
    });
  }

  if (browser.alarms?.onAlarm) {
    let backupInFlight = false;
    browser.alarms.onAlarm.addListener(async (alarm) => {
      if (alarm?.name !== AUTO_BACKUP_ALARM || backupInFlight) return;
      backupInFlight = true;
      try {
        const { useSettingsStore: getStore } = await import('@/stores/settings.store');
        const store = getStore();
        const config = store.settings.exportConfig;
        if (!config.autoBackupEnabled) return;
        await performWebDAVBackup(config);
        await recordBackupSuccess(Date.now());
      } catch (err) {
        await recordBackupError(err instanceof Error ? err.message : String(err));
      } finally {
        backupInFlight = false;
        try {
          const { useSettingsStore: getStore } = await import('@/stores/settings.store');
          const { scheduleAutoBackup } = await import('@/lib/export');
          await scheduleAutoBackup(getStore().settings.exportConfig);
        } catch { /* best-effort */ }
      }
    });
  }

  runtime.onMessage?.addListener((message, _sender, sendResponse) => {
    if (!message || typeof message !== 'object' || !('type' in message)) return;

    if (message.type === 'TRIGGER_EXTRACTION') {
      getActiveTabId().then(async (tabId) => {
        const result = tabId ? await extractFromTab(tabId) : { ok: false };
        sendResponse(result);
      });
      return true;
    }

    if (process.env.NODE_ENV !== 'production') {
      console.debug('[background] message', message);
    }
  });
});
