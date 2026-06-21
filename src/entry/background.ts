/**
 * M1 Entry & Layout — Background Service Worker
 *
 * Responsibilities:
 * - Register chrome.commands shortcuts
 * - Route runtime messages between Content Script (M2), Side Panel (M1),
 *   and other extension entry points
 * - Handle Tab lifecycle events (activation, update)
 * - Manage Side Panel opening/closing
 *
 * Based on design-01-entry-layout.md §4-5.
 */

import { registerCommands } from './commands';
import { uiEventBus } from './event-bus';

// ─── Lifecycle ───────────────────────────────────────────────────────

export function initBackground(): void {
  registerCommands();
  registerMessageRouter();
  registerTabListeners();
  console.log('[M1 Background] Initialized');
}

// ─── Message Router ──────────────────────────────────────────────────

interface RuntimeMessage {
  type: string;
  [key: string]: unknown;
}

const messageHandlers: Record<string, (msg: RuntimeMessage, sender: chrome.runtime.MessageSender) => Promise<unknown>> = {
  EXTRACT_PAGE_RESULT: async (msg) => {
    const payload = msg as unknown as {
      tabId: number;
      title: string;
      url: string;
      text: string;
      wordCount: number;
    };

    uiEventBus.emit('EXTRACT_PAGE_RESULT', {
      tabId: payload.tabId,
      title: payload.title,
      url: payload.url,
      text: payload.text,
      wordCount: payload.wordCount,
    }, 'content-script');

    uiEventBus.emit('CONTEXT_CHANGED', {
      tabId: payload.tabId,
      url: payload.url,
      title: payload.title,
      wordCount: payload.wordCount,
      extractedAt: Date.now(),
      status: 'ready',
    }, 'content-script');

    return { success: true };
  },

  EXTRACT_PAGE_ERROR: async (msg) => {
    const payload = msg as unknown as { tabId: number; error: string };
    uiEventBus.emit('EXTRACT_PAGE_ERROR', payload, 'content-script');
    return { success: true };
  },

  ABORT_ALL_GENERATIONS: async () => {
    uiEventBus.emit('ABORT_ALL_GENERATIONS', null, 'background');

    // Broadcast to all extension views
    const views = chrome.runtime.getViews?.() || [];
    for (const view of views) {
      try {
        view.postMessage({ type: 'ABORT_ALL_GENERATIONS' }, '*');
      } catch {
        // Some views may not support postMessage
      }
    }

    return { success: true };
  },

  GET_CURRENT_CONTEXT: async () => {
    // Will be populated by Side Panel / Popup when context is available
    return { context: null };
  },
};

function registerMessageRouter(): void {
  if (!chrome.runtime) {
    console.warn('[Background] chrome.runtime API is not available');
    return;
  }

  chrome.runtime.onMessage.addListener((msg: RuntimeMessage, sender, sendResponse) => {
    const handler = messageHandlers[msg.type];
    if (handler) {
      handler(msg, sender)
        .then((result) => sendResponse(result))
        .catch((err) => sendResponse({ error: err instanceof Error ? err.message : String(err) }));
      return true; // Keep the channel open for async response
    }
    return false;
  });
}

// ─── Tab Listeners ───────────────────────────────────────────────────

function registerTabListeners(): void {
  if (!chrome.tabs) return;

  chrome.tabs.onActivated.addListener((activeInfo) => {
    uiEventBus.emit('TAB_ACTIVATED', { tabId: activeInfo.tabId }, 'background');
  });

  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
      uiEventBus.emit('TAB_ACTIVATED', { tabId, url: tab.url }, 'background');
    }
  });
}

// ─── Side Panel Helpers ──────────────────────────────────────────────

export async function openSidePanel(tabId?: number): Promise<void> {
  try {
    if (chrome.sidePanel) {
      const currentWindow = await chrome.windows.getCurrent();
      await chrome.sidePanel.open({ windowId: currentWindow.id });
    } else {
      // Fallback: open the Popup
      console.warn('[Background] chrome.sidePanel API not available');
    }
  } catch (err) {
    console.error('[Background] Failed to open side panel:', err);
  }
}

export async function closeSidePanel(): Promise<void> {
  // Chrome does not expose a programmatic close API for Side Panel.
  // We rely on `window.close()` from within the side panel's context,
  // triggered via runtime.sendMessage.
  try {
    await chrome.runtime.sendMessage({ type: 'CLOSE_SIDE_PANEL' });
  } catch {
    // Side panel may not be open
  }
}

// ─── Auto-start ──────────────────────────────────────────────────────

// In extension service worker context, init on load
if (typeof self !== 'undefined' && typeof window === 'undefined') {
  initBackground();
}
