/**
 * Background service worker
 *
 * Responsibilities:
 *  1. Handle extension icon click / keyboard commands
 *  2. Register & handle chrome.contextMenus (M2 — right-click integration)
 *  3. Listen for chrome.tabs.onActivated for context silent anchoring (M2)
 *  4. Schedule WebDAV auto-backup alarms (M7)
 *  5. Relay TRIGGER_EXTRACTION messages from the side panel
 */
import { openSidePanel, broadcastAbort, getActiveTabId, isChromeSidePanelAvailable } from '@/utils/browser';
import { AUTO_BACKUP_ALARM, performWebDAVBackup, recordBackupSuccess, recordBackupError } from '@/lib/export';
import { extractFromTab } from '@/modules/extraction/tab-extractor';
import { initAlarm, handleAlarm, RSS_ALARM_NAME } from '@/lib/rss/scheduler';

// ─── Context menu ids ─────────────────────────────────────────────────────────

const MENU_ROOT = 'ai-reader-root';
const MENU_ITEMS = [
  { id: 'ai-explain',   title: '🔍 解释选中内容',   action: 'explain' },
  { id: 'ai-summarize', title: '📋 总结选中内容',   action: 'summarize' },
  { id: 'ai-translate', title: '🌐 翻译选中内容',   action: 'translate' },
  { id: 'ai-read',      title: '🔊 朗读选中内容',   action: 'read' },
  { id: 'ai-search',    title: '🔎 搜索选中内容',   action: 'search' },
] as const;

type ContextMenuAction = (typeof MENU_ITEMS)[number]['action'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function triggerExtraction(tabId: number | undefined): Promise<void> {
  if (!tabId) return;
  await openSidePanel({ tabId });
  await new Promise((r) => setTimeout(r, 200));
  await extractFromTab(tabId);
}

function registerContextMenus(): void {
  // Guard: chrome.contextMenus may not be available in all browsers / manifest versions
  if (!chrome.contextMenus) return;

  // Remove stale items from previous installs before re-creating
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_ROOT,
      title: 'AI Reader',
      contexts: ['selection'],
    });

    for (const item of MENU_ITEMS) {
      chrome.contextMenus.create({
        id: item.id,
        parentId: MENU_ROOT,
        title: item.title,
        contexts: ['selection'],
      });
    }
  });
}

// ─── Context silent anchoring ─────────────────────────────────────────────────
// When the user switches to a different tab, we keep the previously extracted
// context locked in the side panel (silent anchoring). We broadcast a message
// that the side panel can listen to and display a toast.

async function notifyTabSwitch(tabId: number): Promise<void> {
  try {
    // Read the stored extraction result for the new tab
    const stored = await chrome.storage.local.get('_extraction_result');
    const extracted = stored['_extraction_result'] as
      | { title?: string; url?: string }
      | undefined;

    const title = extracted?.title || 'Unknown page';
    const url = extracted?.url || '';

    // Broadcast to all extension pages (side panel, popup)
    chrome.runtime.sendMessage({
      type: 'TAB_SWITCHED',
      tabId,
      anchoredTitle: title,
      anchoredUrl: url,
    }).catch(() => {
      // No listeners open — that's fine
    });
  } catch {
    // Non-critical; suppress errors
  }
}

// ─── Background definition ────────────────────────────────────────────────────

export default defineBackground(() => {
  if (typeof browser === 'undefined' || !browser?.runtime) return;

  const runtime = browser.runtime;

  // ── 1. Extension icon click ──────────────────────────────────────────────
  if (isChromeSidePanelAvailable() && browser.action?.onClicked) {
    browser.action.onClicked.addListener(async (tab) => {
      await triggerExtraction(tab?.id);
    });
  }

  // ── 2. Keyboard commands ─────────────────────────────────────────────────
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

  // ── 3. Context menu registration + RSS alarm init ────────────────────────
  runtime.onInstalled?.addListener(() => {
    registerContextMenus();
    initAlarm();
  });

  // Also register on startup (in case onInstalled was missed)
  registerContextMenus();

  // Handle context menu clicks
  if (chrome.contextMenus?.onClicked) {
    chrome.contextMenus.onClicked.addListener(async (info, tab) => {
      const action = MENU_ITEMS.find((m) => m.id === info.menuItemId)?.action as
        | ContextMenuAction
        | undefined;
      if (!action) return;

      const text = info.selectionText ?? '';

      // Open side panel first, then send the action
      if (tab?.id) {
        await openSidePanel({ tabId: tab.id }).catch(() => {});
      }

      // Small delay to allow side panel to render
      await new Promise((r) => setTimeout(r, 300));

      chrome.runtime.sendMessage({
        type: 'CONTEXT_MENU_ACTION',
        action,
        text,
      }).catch(() => {});
    });
  }

  // ── 4. Tab activation — silent context anchoring ─────────────────────────
  if (chrome.tabs?.onActivated) {
    chrome.tabs.onActivated.addListener(async (activeInfo) => {
      await notifyTabSwitch(activeInfo.tabId);
    });
  }

  // ── 5. Alarm handler: RSS fetch + WebDAV auto-backup ─────────────────────
  if (browser.alarms?.onAlarm) {
    let backupInFlight = false;
    browser.alarms.onAlarm.addListener(async (alarm) => {
      // RSS 拉取 Alarm
      if (alarm?.name === RSS_ALARM_NAME) {
        try {
          await handleAlarm(alarm.name);
        } catch (err) {
          console.error('[background] RSS alarm handler failed', err);
        }
        return;
      }

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

  // ── 6. Runtime message relay ─────────────────────────────────────────────
  runtime.onMessage?.addListener((message, _sender, sendResponse) => {
    if (!message || typeof message !== 'object' || !('type' in message)) return;

    if (message.type === 'TRIGGER_EXTRACTION') {
      getActiveTabId().then(async (tabId) => {
        const result = tabId ? await extractFromTab(tabId) : { ok: false };
        sendResponse(result);
      });
      return true; // async
    }

    if (process.env.NODE_ENV !== 'production') {
      console.debug('[background] message', message);
    }
  });
});
