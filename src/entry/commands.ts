/**
 * M1 Entry & Layout — Keyboard Commands
 *
 * Registers global Chrome extension commands and maps them
 * to the UI event bus for cross-module dispatch.
 *
 * Based on design-01-entry-layout.md §5.
 */

import { uiEventBus } from './event-bus';

// ─── Command Constants ───────────────────────────────────────────────

export const COMMANDS = {
  OPEN_SIDE_PANEL: 'open-side-panel',
  TOGGLE_SIDE_PANEL: 'toggle-side-panel',
  ABORT_ALL: 'abort-all-generations',
} as const;

export type CommandName = (typeof COMMANDS)[keyof typeof COMMANDS];

// ─── Command Handler Map ─────────────────────────────────────────────

type CommandHandler = (tab?: chrome.tabs.Tab) => Promise<void>;

const commandHandlers: Record<string, CommandHandler> = {
  [COMMANDS.OPEN_SIDE_PANEL]: async (tab) => {
    try {
      // Chrome Side Panel API: open for the current window
      if (chrome.sidePanel) {
        await chrome.sidePanel.open({ windowId: tab?.windowId });
      }
      uiEventBus.emit('SIDE_PANEL_OPENED', { tabId: tab?.id }, 'background');

      // Trigger M2 extraction for the current tab
      if (tab?.id) {
        uiEventBus.emit('EXTRACT_PAGE', { tabId: tab.id }, 'background');
      }
    } catch (err) {
      console.error('[Commands] Failed to open side panel:', err);
    }
  },

  [COMMANDS.TOGGLE_SIDE_PANEL]: async () => {
    uiEventBus.emit('SHORTCUT_TRIGGERED', { command: COMMANDS.TOGGLE_SIDE_PANEL }, 'background');
    // Toggle logic depends on side panel state; the sidepanel entry handles this
  },

  [COMMANDS.ABORT_ALL]: async () => {
    uiEventBus.emit('ABORT_ALL_GENERATIONS', null, 'background');

    // Also broadcast via runtime message to content scripts
    try {
      await chrome.runtime.sendMessage({
        type: 'ABORT_ALL_GENERATIONS',
        timestamp: Date.now(),
      });
    } catch {
      // No active listener — that's fine
    }
  },
};

// ─── Registration ────────────────────────────────────────────────────

/**
 * Register all command handlers with chrome.commands.onCommand.
 * Call once in the background service worker.
 */
export function registerCommands(): void {
  if (!chrome.commands) {
    console.warn('[Commands] chrome.commands API is not available');
    return;
  }

  chrome.commands.onCommand.addListener(async (command: string, tab?: chrome.tabs.Tab) => {
    const handler = commandHandlers[command];
    if (handler) {
      await handler(tab);
    }
  });

  console.log('[Commands] Registered:', Object.values(COMMANDS).join(', '));
}

// ─── Shortcut Helpers ────────────────────────────────────────────────

/**
 * Get the user-configured shortcut string for a command.
 */
export async function getCommandShortcut(command: string): Promise<string> {
  try {
    const commands = await chrome.commands.getAll();
    const cmd = commands.find((c) => c.name === command);
    return cmd?.shortcut || '';
  } catch {
    return '';
  }
}

/**
 * Open the Chrome extension shortcut settings page.
 */
export function openShortcutSettings(): void {
  chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
}
