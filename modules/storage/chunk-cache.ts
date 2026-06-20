import type { ChunkCacheAPI } from './types';

/**
 * M7 — Large text chunk cache for cross-context transfer (M2 → side panel / chat).
 *
 * Strategy: use chrome.storage.session as the primary transport buffer because it
 * is isolated to the running session and automatically cleared when the browser
 * closes. If chrome.storage.session is unavailable (e.g. tests, polyfills), we
 * fall back to an in-memory map. Chunks are short-lived and cleared after assembly.
 */

const TRANSFER_PREFIX = 'transfer:';
const META_SUFFIX = ':meta';

interface TransferMeta {
  totalChunks: number;
  totalSize: number;
}

class ChromeSessionChunkCache implements ChunkCacheAPI {
  private getMetaKey(id: string) {
    return `${TRANSFER_PREFIX}${id}${META_SUFFIX}`;
  }

  private getChunkKey(id: string, index: number) {
    return `${TRANSFER_PREFIX}${id}:chunk:${index}`;
  }

  async setTransferMeta(id: string, meta: TransferMeta): Promise<void> {
    await chrome.storage.session.set({ [this.getMetaKey(id)]: meta });
  }

  async setChunk(id: string, index: number, data: string): Promise<void> {
    await chrome.storage.session.set({ [this.getChunkKey(id, index)]: data });
  }

  async getAllChunks(id: string): Promise<string[]> {
    const metaKey = this.getMetaKey(id);
    const metaRes = await chrome.storage.session.get(metaKey);
    const meta = metaRes[metaKey] as TransferMeta | undefined;
    if (!meta) return [];

    const keys: string[] = [];
    for (let i = 0; i < meta.totalChunks; i++) {
      keys.push(this.getChunkKey(id, i));
    }
    const result = await chrome.storage.session.get(keys);
    const chunks: string[] = [];
    for (let i = 0; i < meta.totalChunks; i++) {
      const chunk = result[this.getChunkKey(id, i)];
      if (typeof chunk === 'string') {
        chunks.push(chunk);
      }
    }
    return chunks;
  }

  async clearTransfer(id: string): Promise<void> {
    const metaKey = this.getMetaKey(id);
    const metaRes = await chrome.storage.session.get(metaKey);
    const meta = metaRes[metaKey] as TransferMeta | undefined;

    const keys: string[] = [metaKey];
    if (meta) {
      for (let i = 0; i < meta.totalChunks; i++) {
        keys.push(this.getChunkKey(id, i));
      }
    }
    await chrome.storage.session.remove(keys);
  }
}

class MemoryChunkCache implements ChunkCacheAPI {
  private meta = new Map<string, TransferMeta>();
  private chunks = new Map<string, string>();

  async setTransferMeta(id: string, meta: TransferMeta): Promise<void> {
    this.meta.set(id, meta);
  }

  async setChunk(id: string, index: number, data: string): Promise<void> {
    this.chunks.set(`${id}:${index}`, data);
  }

  async getAllChunks(id: string): Promise<string[]> {
    const meta = this.meta.get(id);
    if (!meta) return [];
    const chunks: string[] = [];
    for (let i = 0; i < meta.totalChunks; i++) {
      const value = this.chunks.get(`${id}:${i}`);
      if (value !== undefined) {
        chunks.push(value);
      }
    }
    return chunks;
  }

  async clearTransfer(id: string): Promise<void> {
    this.meta.delete(id);
    for (const key of this.chunks.keys()) {
      if (key.startsWith(`${id}:`)) {
        this.chunks.delete(key);
      }
    }
  }
}

function hasChromeSession(): boolean {
  return typeof chrome !== 'undefined' && !!(chrome.storage && chrome.storage.session);
}

let _cache: ChunkCacheAPI | null = null;

export function getChunkCache(): ChunkCacheAPI {
  if (!_cache) {
    _cache = hasChromeSession() ? new ChromeSessionChunkCache() : new MemoryChunkCache();
  }
  return _cache;
}

export function resetChunkCache(): ChunkCacheAPI {
  _cache = hasChromeSession() ? new ChromeSessionChunkCache() : new MemoryChunkCache();
  return _cache;
}

export { ChromeSessionChunkCache, MemoryChunkCache };
