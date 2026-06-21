/**
 * M2 — Content script entrypoint
 * Listens for EXTRACT_PAGE requests, performs 3-level extraction, and supports chunked transfer.
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

// In-memory cache for chunk data (content script lifetime is page-bound)
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
  },
});

async function handleMessage(
  message: ExtractRequest | ChunkRequest
): Promise<ExtractResponse | TransferMetaMessage | ChunkResponse | null> {
  if (message.type === 'EXTRACT_PAGE') {
    return handleExtractPage(message);
  }
  if (message.type === 'REQUEST_CHUNK') {
    return handleChunkRequest(message);
  }
  return null;
}

async function handleExtractPage(request: ExtractRequest): Promise<ExtractResponse | TransferMetaMessage> {
  try {
    if (document.readyState !== 'complete' && document.readyState !== 'interactive') {
      await waitForDomReady(document);
    }

    const context = await extractPage(document, {
      preferredFormat: request.preferredFormat,
    });

    // Persist to chrome.storage.local so the side panel / popup can
    // pick it up even if the caller doesn't capture the sendResponse.
    try {
      const partial: Record<string, unknown> = {
        title: context.title,
        url: context.url,
        excerpt: context.content.slice(0, 600),
        fullText: context.content,
        rawText: context.content,
        mode: 'full',
      };
      await chrome.storage.local.set({ _extraction_result: partial });
    } catch {
      // best-effort
    }

    // If content is large, cache chunks and return metadata only
    if (context.content.length > 1024 * 1024) {
      const transferId = generateTransferId(context.url);
      const chunks = splitIntoChunks(context.content);
      chunkCache.set(transferId, chunks);

      // Return metadata; caller will request chunks via REQUEST_CHUNK
      return createTransferMeta(transferId, chunks.length, context.content.length);
    }

    return {
      type: 'EXTRACT_RESULT',
      success: true,
      context,
    };
  } catch (err) {
    console.error('[M2] Extraction failed:', err);
    return {
      type: 'EXTRACT_RESULT',
      success: false,
      error: {
        code: 'UNKNOWN',
        message: String(err),
      },
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
    chunks.length
  );
}
