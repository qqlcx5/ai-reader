// ============================================================
// SuperBrain Background Service Worker
// ============================================================

import type { ExtractResult, PageMetadata } from '../shared/domain';

export default defineBackground(() => {
  console.log('[SuperBrain] Background service worker started', { id: browser.runtime.id });

  // ---- Generation Counter ----
  let generation = 0;

  // ---- Extraction Result Cache (TTL: 5s) ----
  const extractCache = new Map<string, {
    result: ExtractResult; metadata: PageMetadata; markdown: string; timestamp: number;
  }>();
  const CACHE_TTL_MS = 5000;

  function cacheKey(tabId: number, url: string): string {
    return `${tabId}|${url}`;
  }

  function getCached(tabId: number, url: string) {
    const key = cacheKey(tabId, url);
    const entry = extractCache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
      extractCache.delete(key);
      return null;
    }
    return entry;
  }

  function setCache(
    tabId: number, url: string,
    result: ExtractResult, metadata: PageMetadata, markdown: string,
  ) {
    extractCache.set(cacheKey(tabId, url), { result, metadata, markdown, timestamp: Date.now() });
  }

  // ---- Message Listener ----
  browser.runtime.onMessage.addListener((message: any, sender: any, sendResponse: any) => {
    if (!message?.type) return false;

    switch (message.type) {
      case 'ping':
        generation += 1;
        sendResponse({ generation, status: 'ready' });
        return true;

      case 'CAPTURE_PROGRESS': {
        const { step, error } = message.payload || {};
        if (step) {
          browser.runtime.sendMessage({
            type: 'CAPTURE_PROGRESS',
            payload: { step, error },
          }).catch(() => {});
        }
        return false;
      }

      case 'EXTRACT_PAGE':
        handleExtractFromPopup(sender, sendResponse);
        return true;

      default:
        return false;
    }
  });

  // ---- Handle extract request from Popup ----
  async function handleExtractFromPopup(sender: any, sendResponse: (resp: any) => void) {
    try {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) {
        sendResponse({ status: 'error', error: 'NO_ACTIVE_TAB' });
        return;
      }

      const url = tab.url || '';
      const tabId = tab.id;

      // Check cache
      const cached = getCached(tabId, url);
      if (cached) {
        sendResponse({
          status: 'ok',
          data: {
            extractResult: cached.result,
            metadata: cached.metadata,
            markdown: cached.markdown,
            cached: true,
          },
        });
        return;
      }

      // Run capture pipeline
      const data = await runCapturePipeline(tabId, url);
      sendResponse({ status: 'ok', data: { ...data, cached: false } });
    } catch (err: any) {
      const msg = err?.message || String(err);
      console.error('[SuperBrain] Extract failed:', msg);
      sendResponse({ status: 'error', error: msg });
    }
  }

  // ---- Capture Pipeline ----
  async function runCapturePipeline(
    tabId: number, url: string,
  ): Promise<{ extractResult: ExtractResult; metadata: PageMetadata; markdown: string }> {
    // Step 1: Ensure main content script is injected
    await ensureContentScriptInjected(tabId);

    // Step 2: Ping for readiness
    await pingContentScript(tabId, 3000, 10);

    // Step 3: Inject extraction content script (heavy, defuddle)
    const result = await injectAndExtract(tabId);

    if (result?.status !== 'ok' || !result?.data) {
      throw new Error(result?.error || 'EXTRACTION_FAILED');
    }

    const { extractResult, metadata, markdown } = result.data;
    setCache(tabId, url, extractResult, metadata, markdown);

    return { extractResult, metadata, markdown };
  }

  // ---- Inject extract script and run extraction ----
  async function injectAndExtract(tabId: number): Promise<any> {
    // Inject the extraction content script
    await browser.scripting.executeScript({
      target: { tabId },
      files: ['content-scripts/extract.js'],
    });

    // Wait a tick for the script to initialize
    await sleep(200);

    // Send extraction command to the injected script
    return browser.tabs.sendMessage(tabId, {
      type: 'EXECUTE_EXTRACT',
      payload: {},
    });
  }

  // ---- Content Script Injection ----
  async function ensureContentScriptInjected(tabId: number): Promise<void> {
    try {
      const resp = await browser.tabs.sendMessage(tabId, { type: 'ping', payload: {} });
      if (resp?.status === 'ready') return;
    } catch { /* not injected yet */ }

    try {
      await browser.scripting.executeScript({
        target: { tabId },
        files: ['content-scripts/content.js'],
      });
    } catch { /* may fail on restricted pages */ }
  }

  async function pingContentScript(tabId: number, timeoutMs: number, maxRetries: number): Promise<void> {
    const start = Date.now();
    for (let i = 0; i < maxRetries; i++) {
      if (Date.now() - start > timeoutMs) throw new Error('CONTENT_SCRIPT_TIMEOUT');
      try {
        const resp = await browser.tabs.sendMessage(tabId, { type: 'ping', payload: {} });
        if (resp?.status === 'ready') return;
      } catch { /* retry */ }
      await sleep(Math.min(100 * Math.pow(2, i), 2000));
    }
    throw new Error('CONTENT_SCRIPT_TIMEOUT');
  }

  function sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }

  // ---- Side Panel ----
  browser.sidePanel?.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
});
