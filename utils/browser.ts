/**
 * Chrome Side Panel / extension helpers.
 *
 * Uses WXT's `browser` global for cross-browser compatibility (Chrome,
 * Firefox, Edge). The `chrome.*` namespace is aliased to the same shape at
 * runtime, so existing code paths that read chrome.storage / chrome.tabs
 * continue to work.
 *
 * The wrappers below are test-friendly: each function returns null/false
 * when the underlying API is missing, so unit tests can polyfill only the
 * pieces they need.
 */

export function isChromeSidePanelAvailable(): boolean {
  return (
    typeof browser !== 'undefined' &&
    !!(browser as any).sidePanel &&
    typeof (browser as any).sidePanel.open === 'function'
  );
}

export function isChromeTabsAvailable(): boolean {
  return typeof browser !== 'undefined' && !!browser.tabs && typeof browser.tabs.query === 'function';
}

export function isChromeWindowsAvailable(): boolean {
  return (
    typeof browser !== 'undefined' &&
    !!browser.windows &&
    typeof (browser.windows as any).getCurrent === 'function'
  );
}

export function isChromeRuntimeAvailable(): boolean {
  return (
    typeof browser !== 'undefined' && !!browser.runtime && typeof browser.runtime.sendMessage === 'function'
  );
}

export function isChromeCommandsAvailable(): boolean {
  return (
    typeof browser !== 'undefined' &&
    !!browser.commands &&
    !!(browser.commands as any).onCommand
  );
}

/**
 * Open the side panel for the current window. No-op when API is unavailable.
 */
export async function openSidePanel(options: { tabId?: number; windowId?: number } = {}): Promise<boolean> {
  if (!isChromeSidePanelAvailable()) return false;
  try {
    if (options.tabId !== undefined) {
      await (browser as any).sidePanel.open({ tabId: options.tabId });
    } else if (options.windowId !== undefined) {
      await (browser as any).sidePanel.open({ windowId: options.windowId });
    } else {
      const windowId = await getCurrentWindowId();
      if (windowId === null) return false;
      await (browser as any).sidePanel.open({ windowId });
    }
    return true;
  } catch (err) {
    console.warn('[browser] openSidePanel failed', err);
    return false;
  }
}

export async function getCurrentWindowId(): Promise<number | null> {
  if (!isChromeWindowsAvailable()) return null;
  try {
    const win = await (browser.windows as any).getCurrent();
    return win?.id ?? null;
  } catch {
    return null;
  }
}

export async function getActiveTabId(): Promise<number | null> {
  if (!isChromeTabsAvailable()) return null;
  try {
    const tabs = await browser.tabs.query({ active: true, lastFocusedWindow: true });
    return tabs[0]?.id ?? null;
  } catch {
    return null;
  }
}

export interface OpenAndExtractOptions {
  tabId?: number;
  windowId?: number;
}

/**
 * Open the side panel. Extraction is now handled by background.ts's
 * triggerExtraction which uses tabs.sendMessage directly.
 */
export async function openSidePanelAndExtract(options: OpenAndExtractOptions = {}): Promise<boolean> {
  return openSidePanel(options);
}

export async function toggleSidePanel(): Promise<void> {
  // Chrome does not expose close() for side panels. Toggling relies on
  // user clicking the toolbar icon; we simply re-open.
  await openSidePanel();
}

export async function broadcastAbort(): Promise<void> {
  if (!isChromeRuntimeAvailable()) return;
  try {
    await browser.runtime.sendMessage({
      type: 'ABORT_ALL_REQUESTS',
      ts: Date.now(),
      source: 'background',
    } as any);
  } catch {
    /* no receivers */
  }
}
