/**
 * M2 — Content script entrypoint
 *
 * Responsibilities:
 *  1. Respond to EXTRACT_PAGE messages (3-level fallback extraction)
 *  2. Serve large content via REQUEST_CHUNK messages (chunked transfer)
 *  3. Mount a Shadow-DOM floating toolbar on text selection
 *  4. Mount the Highlighter for selection persistence
 *
 * The floating toolbar sends chrome.runtime messages to the side panel:
 *   { type: 'TOOLBAR_ACTION', action, text }
 */
import { extractPage, waitForDomReady } from '@/modules/extraction';
import type {
  ExtractRequest,
  ExtractResponse,
  ChunkRequest,
  ChunkResponse,
  TransferMetaMessage,
} from '@/modules/extraction';
import {
  splitIntoChunks,
  createTransferMeta,
  createChunkResponse,
  generateTransferId,
} from '@/modules/extraction';
import { FloatingToolbar } from './floating-toolbar';
import type { ToolbarAction } from './floating-toolbar';
import { Highlighter } from '@/lib/extraction/highlighter';
import { AreaSelector } from '@/lib/extraction/area-selector';

// In-memory chunk cache (scoped to this content-script lifetime)
const chunkCache = new Map<string, string[]>();

export default defineContentScript({
  matches: ['<all_urls>'],
  excludeMatches: [
    '*://chrome.google.com/*',
    '*://chromewebstore.google.com/*',
    'chrome-extension://*/*',
  ],
  async main() {
    console.log('[AI Reader] Content script loaded on', location.href);

    // ── Extraction message handler ─────────────────────────────────────────
    browser.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
      handleMessage(message as ExtractRequest | ChunkRequest)
        .then((response) => sendResponse(response))
        .catch((err: unknown) => {
          console.error('[M2] Content script error:', err);
          sendResponse({
            type: 'EXTRACT_RESULT',
            success: false,
            error: { code: 'UNKNOWN', message: String(err) },
          } as ExtractResponse);
        });
      return true; // async response
    });

    // ── Floating toolbar ───────────────────────────────────────────────────
    const toolbar = new FloatingToolbar(handleToolbarAction);
    toolbar.mount();

    // ── Highlighter ────────────────────────────────────────────────────────
    // Use URL as pageId until M8 conversation IDs are available
    const pageId = location.href;
    const highlighter = new Highlighter({ pageId });
    highlighter.mount();

    // Restore previously saved highlights after page load
    if (document.readyState === 'complete') {
      void highlighter.restore();
    } else {
      document.addEventListener('DOMContentLoaded', () => void highlighter.restore(), { once: true });
    }

    // Expose highlighter + area selector on the global for debugging
    if (process.env.NODE_ENV !== 'production') {
      (window as any).__aiReaderHighlighter = highlighter;
      (window as any).__aiReaderAreaSelector = new AreaSelector((result) => {
        console.log('[M2] Area selection result:', result);
      });
    }
  },
});

// ─── Toolbar action handler ───────────────────────────────────────────────────

function handleToolbarAction(action: ToolbarAction, text: string): void {
  browser.runtime.sendMessage({
    type: 'TOOLBAR_ACTION',
    action,
    text,
  }).catch(() => {
    // Side panel may not be open — suppress the error
  });
}

// ─── Message handlers ─────────────────────────────────────────────────────────

async function handleMessage(
  message: ExtractRequest | ChunkRequest,
): Promise<ExtractResponse | TransferMetaMessage | ChunkResponse | null> {
  if (message.type === 'EXTRACT_PAGE') {
    return handleExtractPage(message);
  }
  if (message.type === 'REQUEST_CHUNK') {
    return handleChunkRequest(message);
  }
  return null;
}

async function handleExtractPage(
  request: ExtractRequest,
): Promise<ExtractResponse | TransferMetaMessage> {
  try {
    if (document.readyState !== 'complete' && document.readyState !== 'interactive') {
      await waitForDomReady(document);
    }

    const context = await extractPage(document, {
      preferredFormat: request.preferredFormat,
    });

    // Persist to chrome.storage.local so side panel / popup can pick it up
    try {
      await chrome.storage.local.set({
        _extraction_result: {
          title: context.title,
          url: context.url,
          excerpt: context.content.slice(0, 600),
          fullText: context.content,
          rawText: context.content,
          mode: 'full',
        },
      });
    } catch {
      // best-effort
    }

    // Chunked transfer for content > 1 MB (no truncation)
    if (context.content.length > 1024 * 1024) {
      const transferId = generateTransferId(context.url);
      const chunks = splitIntoChunks(context.content);
      chunkCache.set(transferId, chunks);
      return createTransferMeta(transferId, chunks.length, context.content.length);
    }

    return { type: 'EXTRACT_RESULT', success: true, context };
  } catch (err) {
    console.error('[M2] Extraction failed:', err);
    return {
      type: 'EXTRACT_RESULT',
      success: false,
      error: { code: 'UNKNOWN', message: String(err) },
    };
  }
}

function handleChunkRequest(request: ChunkRequest): ChunkResponse | null {
  const chunks = chunkCache.get(request.transferId);
  if (!chunks || request.chunkIndex < 0 || request.chunkIndex >= chunks.length) {
    return null;
  }
  return createChunkResponse(
    request.transferId,
    request.chunkIndex,
    chunks[request.chunkIndex],
    chunks.length,
  );
}
