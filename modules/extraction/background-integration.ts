/**
 * M2 — Background script integration for chunked transfer and context anchoring
 */
import type {
  ExtractedContext,
  ChunkedTransfer,
  TransferMetaMessage,
  ChunkRequest,
  ChunkResponse,
} from '@/modules/extraction';

// Lazy import to avoid SSR/build-time resolution issues
async function getChunkCache() {
  const { getChunkCache: getCache } = await import('@/modules/storage/chunk-cache');
  return getCache();
}

export async function performExtraction(tabId: number): Promise<ExtractedContext | null> {
  // Send extract request to content script
  const response = await browser.tabs.sendMessage(tabId, {
    type: 'EXTRACT_PAGE',
    force: true,
    preferredFormat: 'markdown',
  });

  if (!response) return null;

  // If response is a transfer meta, we need to fetch chunks
  if (response.type === 'TRANSFER_META') {
    return await fetchChunksAndAssemble(tabId, response as TransferMetaMessage);
  }

  // Direct result
  if (response.success && response.context) {
    return response.context as ExtractedContext;
  }

  return null;
}

async function fetchChunksAndAssemble(
  tabId: number,
  meta: TransferMetaMessage
): Promise<ExtractedContext | null> {
  const cache = await getChunkCache();
  await cache.setTransferMeta(meta.transferId, {
    totalChunks: meta.totalChunks,
    totalSize: meta.totalSize,
  });

  const chunks: ChunkedTransfer[] = [];

  for (let i = 0; i < meta.totalChunks; i++) {
    const chunkResponse = await browser.tabs.sendMessage(tabId, {
      type: 'REQUEST_CHUNK',
      transferId: meta.transferId,
      chunkIndex: i,
    } as ChunkRequest);

    if (!chunkResponse) {
      console.error(`[M2] Failed to fetch chunk ${i}`);
      continue;
    }

    const cr = chunkResponse as ChunkResponse;
    await cache.setChunk(meta.transferId, i, cr.chunkData);
    chunks.push({
      transferId: cr.transferId,
      totalChunks: meta.totalChunks,
      chunkIndex: cr.chunkIndex,
      chunkData: cr.chunkData,
      isLast: cr.isLast,
    });
  }

  // Assemble
  const assembled = chunks.sort((a, b) => a.chunkIndex - b.chunkIndex).map((c) => c.chunkData).join('');

  // Cleanup
  await cache.clearTransfer(meta.transferId);

  // We don't have the metadata here; the caller should merge with the meta
  // For now, return a minimal context that will be enriched by the caller
  return {
    url: '',
    title: '',
    extractedAt: Date.now(),
    wordCount: assembled.length,
    content: assembled,
    format: 'markdown',
    extractor: 'readability',
  };
}

/**
 * Write extracted context to the context store (via chrome.storage.local).
 * This is called by the side panel or background after extraction.
 */
export async function anchorContext(context: ExtractedContext): Promise<void> {
  const storeKey = 'context-store';
  const current = await browser.storage.local.get(storeKey);
  const data = current[storeKey] ? JSON.parse(current[storeKey] as string) : {};

  data.currentContext = {
    title: context.title,
    url: context.url,
    excerpt: context.content.slice(0, 500),
    fullText: context.content,
    readabilityHtml: '',
    rawText: context.content,
    mode: 'full',
  };

  await browser.storage.local.set({ [storeKey]: JSON.stringify(data) });
}
