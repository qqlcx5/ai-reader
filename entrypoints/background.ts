import { openSidePanel, broadcastAbort, getActiveTabId, isChromeSidePanelAvailable } from '@/utils/browser';
import { AUTO_BACKUP_ALARM, performWebDAVBackup, recordBackupSuccess, recordBackupError } from '@/lib/export';

async function triggerExtraction(tabId: number | undefined) {
  if (!tabId) return;
  // Open side panel first (if not already open)
  await openSidePanel({ tabId });

  // Wait briefly for side panel to mount its listeners
  await new Promise((r) => setTimeout(r, 200));

  try {
    // Send extraction request directly to the content script in the given tab
    const response = await browser.tabs.sendMessage(tabId, {
      type: 'EXTRACT_PAGE',
      force: false,
      preferredFormat: 'markdown',
    }) as Record<string, unknown>;

    if (!response || typeof response !== 'object') return;

    if (response.type === 'EXTRACT_RESULT' && response.success && response.context) {
      const c = response.context as Record<string, unknown>;
      const content = String(c.content || '');
      const ctx = {
        title: String(c.title || ''),
        url: String(c.url || ''),
        excerpt: content.slice(0, 600),
        fullText: content,
        rawText: content,
        mode: 'full',
      };
      await chrome.storage.local.set({ _extraction_result: ctx });
    } else if (response.type === 'TRANSFER_META') {
      const meta = response as Record<string, unknown>;
      const transferId = String(meta.transferId || '');
      const totalChunks = Number(meta.totalChunks || 0);
      const chunks: string[] = [];
      for (let i = 0; i < totalChunks; i++) {
        try {
          const chunkResp = await browser.tabs.sendMessage(tabId, {
            type: 'REQUEST_CHUNK',
            transferId,
            chunkIndex: i,
          }) as Record<string, unknown> | null;
          if (chunkResp?.type === 'CHUNK_DATA' && typeof chunkResp.chunkData === 'string') {
            chunks.push(chunkResp.chunkData);
          }
        } catch { /* skip failed chunk */ }
      }
      const fullContent = chunks.join('');
      await chrome.storage.local.set({
        _extraction_result: {
          title: '',
          url: '',
          excerpt: fullContent.slice(0, 600),
          fullText: fullContent,
          rawText: fullContent,
          mode: 'full',
        },
      });
    }
  } catch (err) {
    console.warn('[background] extraction failed', err);
  }
}

export default defineBackground(() => {
  if (typeof browser === 'undefined' || !browser?.runtime) {
    return;
  }

  const runtime = browser.runtime;

  // Enable side panel on action click
  if (isChromeSidePanelAvailable() && browser.action?.onClicked) {
    browser.action.onClicked.addListener(async (tab) => {
      await triggerExtraction(tab?.id);
    });
  }

  // Keyboard command routing.
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
        default:
          break;
      }
    });
  }

  // M6 — auto-backup alarm handler
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
          console.debug('[background] auto-backup done', result.remotePath);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await recordBackupError(message);
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[background] auto-backup failed', message);
        }
      } finally {
        backupInFlight = false;
        try {
          const { scheduleAutoBackup } = await import('@/lib/export');
          const { useSettingsStore } = await import('@/stores/settings.store');
          await scheduleAutoBackup(useSettingsStore().settings.exportConfig);
        } catch { /* best-effort */ }
      }
    });
  }

  // Relay any incoming extraction message from content script
  runtime.onMessage?.addListener((message) => {
    if (!message || typeof message !== 'object' || !('type' in message)) return;
    if (process.env.NODE_ENV !== 'production') {
      console.debug('[background] message', message);
    }
  });
});
