import type { ExtractResponse, TransferMetaMessage, ChunkResponse } from './types';

const MIN_CONTENT = 50;

export interface ExtractionResult {
  ok: boolean;
  title: string;
  url: string;
  fullText: string;
}

async function fetchChunks(tabId: number, transferId: string, totalChunks: number): Promise<string> {
  const chunks: string[] = [];
  for (let i = 0; i < totalChunks; i++) {
    try {
      const cr = await browser.tabs.sendMessage(tabId, {
        type: 'REQUEST_CHUNK', transferId, chunkIndex: i,
      }) as ChunkResponse | null;
      if (cr?.type === 'CHUNK_DATA' && typeof cr.chunkData === 'string') {
        chunks.push(cr.chunkData);
      }
    } catch { /* skip failed chunk */ }
  }
  return chunks.join('');
}

function isValidContent(text: string): boolean {
  return text.length >= MIN_CONTENT;
}

function toStoragePayload(title: string, url: string, fullText: string) {
  return { title, url, excerpt: fullText.slice(0, 600), fullText, rawText: fullText, mode: 'full' };
}

export async function extractFromTab(tabId: number): Promise<ExtractionResult> {
  const fail = () => ({ ok: false, title: '', url: '', fullText: '' });

  let response: ExtractResponse | TransferMetaMessage;
  try {
    response = await browser.tabs.sendMessage(tabId, {
      type: 'EXTRACT_PAGE', force: false, preferredFormat: 'markdown',
    }) as ExtractResponse | TransferMetaMessage;
  } catch (err) {
    console.warn('[extractor] tabs.sendMessage failed:', err);
    return fail();
  }

  if (!response || typeof response !== 'object') return fail();

  if (response.type === 'EXTRACT_RESULT') {
    if (!response.success || !response.context) return fail();
    const content = response.context.content || '';
    if (!isValidContent(content)) return fail();
    const title = response.context.title || '';
    const url = response.context.url || '';
    const payload = toStoragePayload(title, url, content);
    await chrome.storage.local.set({ _extraction_result: payload }).catch(() => {});
    return { ok: true, title, url, fullText: content };
  }

  if (response.type === 'TRANSFER_META') {
    const fullText = await fetchChunks(tabId, response.transferId, response.totalChunks);
    if (!isValidContent(fullText)) return fail();
    const payload = toStoragePayload('', '', fullText);
    await chrome.storage.local.set({ _extraction_result: payload }).catch(() => {});
    return { ok: true, title: '', url: '', fullText };
  }

  return fail();
}
