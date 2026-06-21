/**
 * M1 Entry & Layout — Popup Entry
 *
 * Lightweight controller displayed when the user clicks the extension icon.
 * Shows current page status and provides quick actions.
 * Does NOT render long text or initiate LLM requests.
 *
 * Based on design-01-entry-layout.md §4.1.
 */

import { uiEventBus } from './event-bus';
import { AppRoute } from './routes';
import type { UiEvent } from './event-bus';

// ─── State ───────────────────────────────────────────────────────────

export interface PopupState {
  tabTitle: string;
  tabUrl: string;
  wordCount: number | null;
  extractionStatus: 'idle' | 'extracting' | 'ready' | 'error';
  lastError?: string;
  sidePanelOpen: boolean;
}

const popupState: PopupState = {
  tabTitle: '',
  tabUrl: '',
  wordCount: null,
  extractionStatus: 'idle',
  sidePanelOpen: false,
};

// ─── Actions ─────────────────────────────────────────────────────────

export async function initPopup(): Promise<PopupState> {
  // Get current tab info
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      popupState.tabTitle = tab.title || '';
      popupState.tabUrl = tab.url || '';
    }
  } catch {
    // Tab info unavailable
  }

  // Subscribe to events
  uiEventBus.on('CONTEXT_CHANGED', (event: UiEvent) => {
    const ctx = event.payload as { wordCount: number; status: string };
    if (ctx) {
      popupState.wordCount = ctx.wordCount;
      popupState.extractionStatus = ctx.status as PopupState['extractionStatus'];
    }
    updatePopupUI();
  });

  uiEventBus.on('EXTRACT_PAGE_ERROR', (event: UiEvent) => {
    const payload = event.payload as { error: string };
    popupState.extractionStatus = 'error';
    popupState.lastError = payload?.error;
    updatePopupUI();
  });

  return popupState;
}

// ─── User Actions ────────────────────────────────────────────────────

/** Open the Side Panel for the current window. */
export async function openSidePanelFromPopup(): Promise<void> {
  try {
    if (chrome.sidePanel) {
      const window = await chrome.windows.getCurrent();
      await chrome.sidePanel.open({ windowId: window.id });
      popupState.sidePanelOpen = true;
    }
  } catch (err) {
    console.error('[Popup] Failed to open side panel:', err);
  }
}

/** Trigger M2 extraction on the current tab. */
export async function extractCurrentPage(): Promise<void> {
  popupState.extractionStatus = 'extracting';
  updatePopupUI();

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      await chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT_PAGE' });
    }
  } catch (err) {
    popupState.extractionStatus = 'error';
    popupState.lastError = err instanceof Error ? err.message : String(err);
    updatePopupUI();
  }
}

/** Navigate to the Settings/Options page. */
export function openOptionsPage(): void {
  chrome.runtime.openOptionsPage();
}

/** Close the popup. Called when user clicks outside or presses Escape. */
export function closePopup(): void {
  if (typeof window !== 'undefined') {
    window.close();
  }
}

// ─── UI Update ───────────────────────────────────────────────────────

let updatePopupUI: () => void = () => {};

/** Set the UI update callback (called by the Vue/React component). */
export function onPopupStateChange(callback: () => void): void {
  updatePopupUI = callback;
}

/** Get current popup state snapshot. */
export function getPopupState(): Readonly<PopupState> {
  return popupState;
}
