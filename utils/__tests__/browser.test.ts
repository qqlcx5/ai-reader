import { describe, it, expect, beforeEach, vi } from 'vitest';

// Polyfill the WXT `browser` global expected by utils/browser.ts.
// jsdom does not provide it, so we install a minimal stub here. The
// beforeEach resets it so each test can mutate the API surface freely.
function installBrowser(stub: Record<string, unknown> = {}) {
  (globalThis as any).browser = { ...stub };
}

describe('utils/browser', () => {
  beforeEach(() => {
    // Reset between tests.
    delete (globalThis as any).browser;
  });

  it('isChromeSidePanelAvailable returns false when browser is undefined', async () => {
    const { isChromeSidePanelAvailable } = await import('../browser');
    expect(isChromeSidePanelAvailable()).toBe(false);
  });

  it('isChromeSidePanelAvailable returns true when API exists', async () => {
    const { isChromeSidePanelAvailable } = await import('../browser');
    installBrowser({ sidePanel: { open: vi.fn() } });
    expect(isChromeSidePanelAvailable()).toBe(true);
  });

  it('isChromeTabsAvailable is false without tabs', async () => {
    const { isChromeTabsAvailable } = await import('../browser');
    expect(isChromeTabsAvailable()).toBe(false);
  });

  it('isChromeTabsAvailable is true with tabs', async () => {
    const { isChromeTabsAvailable } = await import('../browser');
    installBrowser({ tabs: { query: vi.fn() } });
    expect(isChromeTabsAvailable()).toBe(true);
  });

  it('getActiveTabId returns null when tabs API is missing', async () => {
    const { getActiveTabId } = await import('../browser');
    expect(await getActiveTabId()).toBeNull();
  });

  it('getActiveTabId returns the first tab id', async () => {
    const { getActiveTabId } = await import('../browser');
    installBrowser({ tabs: { query: vi.fn().mockResolvedValue([{ id: 42 }]) } });
    expect(await getActiveTabId()).toBe(42);
  });

  it('getCurrentWindowId returns null when no current window', async () => {
    const { getCurrentWindowId } = await import('../browser');
    installBrowser({ windows: { getCurrent: vi.fn().mockResolvedValue(null) } });
    expect(await getCurrentWindowId()).toBeNull();
  });

  it('getCurrentWindowId returns the id', async () => {
    const { getCurrentWindowId } = await import('../browser');
    installBrowser({ windows: { getCurrent: vi.fn().mockResolvedValue({ id: 7 }) } });
    expect(await getCurrentWindowId()).toBe(7);
  });

  it('openSidePanel returns false when API missing', async () => {
    const { openSidePanel } = await import('../browser');
    expect(await openSidePanel()).toBe(false);
  });

  it('openSidePanel opens by tabId when provided', async () => {
    const { openSidePanel } = await import('../browser');
    const open = vi.fn().mockResolvedValue(undefined);
    installBrowser({ sidePanel: { open }, runtime: { sendMessage: vi.fn() } });
    expect(await openSidePanel({ tabId: 11 })).toBe(true);
    expect(open).toHaveBeenCalledWith({ tabId: 11 });
  });

  it('openSidePanel falls back to windowId', async () => {
    const { openSidePanel } = await import('../browser');
    const open = vi.fn().mockResolvedValue(undefined);
    installBrowser({
      sidePanel: { open },
      windows: { getCurrent: vi.fn().mockResolvedValue({ id: 9 }) },
      runtime: { sendMessage: vi.fn() },
    });
    expect(await openSidePanel({})).toBe(true);
    expect(open).toHaveBeenCalledWith({ windowId: 9 });
  });

  it('openSidePanel swallows API errors and returns false', async () => {
    const { openSidePanel } = await import('../browser');
    const open = vi.fn().mockRejectedValue(new Error('denied'));
    installBrowser({ sidePanel: { open } });
    expect(await openSidePanel({ tabId: 1 })).toBe(false);
  });

  it('broadcastAbort is a no-op without runtime', async () => {
    const { broadcastAbort } = await import('../browser');
    await expect(broadcastAbort()).resolves.toBeUndefined();
  });

  it('broadcastAbort sends ABORT_ALL_REQUESTS', async () => {
    const { broadcastAbort } = await import('../browser');
    const sendMessage = vi.fn().mockResolvedValue(undefined);
    installBrowser({ runtime: { sendMessage } });
    await broadcastAbort();
    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'ABORT_ALL_REQUESTS', source: 'background' }),
    );
  });

  it('openSidePanelAndExtract opens then dispatches EXTRACT_PAGE', async () => {
    vi.useFakeTimers();
    const { openSidePanelAndExtract } = await import('../browser');
    const open = vi.fn().mockResolvedValue(undefined);
    const sendMessage = vi.fn().mockResolvedValue(undefined);
    installBrowser({ sidePanel: { open }, runtime: { sendMessage } });
    const p = openSidePanelAndExtract({ tabId: 3 });
    await vi.advanceTimersByTimeAsync(100);
    await p;
    expect(open).toHaveBeenCalledWith({ tabId: 3 });
    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'EXTRACT_PAGE', payload: { tabId: 3 } }),
    );
    vi.useRealTimers();
  });
});
