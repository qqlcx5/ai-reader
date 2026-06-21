/**
 * Chunk Cache — Large text transfer buffer
 *
 * When M2 extracts multi-megabyte page content, it needs to transfer
 * the data from the content script to the side panel via the background
 * service worker. This cache provides temporary storage for chunked
 * transfers using chrome.storage.session (or IndexedDB fallback).
 *
 * Based on design-07-storage-data.md §8.
 */

import type { ChunkCacheAPI } from './types';

// ─── Session Storage Implementation ─────────────────────────────────

/**
 * Chrome extension content scripts use message-based communication.
 * chrome.storage.session holds data for the session lifetime and is
 * automatically cleared on browser restart — ideal for ephemeral
 * transfer buffers.
 *
 * Fallback: if session storage quota is exceeded, fall back to
 * IndexedDB temporary entries.
 */
export class SessionChunkCache implements ChunkCacheAPI {
  private sessionArea = chrome.storage.session;
  private metaKey = (id: string) => `chunk_meta:${id}`;
  private chunkKey = (id: string, index: number) => `chunk:${id}:${index}`;

  async setTransferMeta(
    id: string,
    meta: { totalChunks: number; totalSize: number },
  ): Promise<void> {
    await this.sessionArea.set({ [this.metaKey(id)]: meta });
  }

  async setChunk(
    id: string,
    index: number,
    data: string,
  ): Promise<void> {
    try {
      await this.sessionArea.set({
        [this.chunkKey(id, index)]: data,
      });
    } catch (err) {
      // session quota exceeded — fall through to IndexedDB
      if (
        err instanceof Error &&
        err.message.includes('MAX_WRITE_OPERATIONS')
      ) {
        await this.setChunkFallback(id, index, data);
        return;
      }
      throw err;
    }
  }

  async getAllChunks(id: string): Promise<string[]> {
    const meta = await this.getMeta(id);
    if (!meta) return [];

    const results: string[] = [];
    for (let i = 0; i < meta.totalChunks; i++) {
      const key = this.chunkKey(id, i);
      const stored = await this.sessionArea.get(key);
      if (stored[key] !== undefined) {
        results.push(stored[key] as string);
      } else {
        // Try IndexedDB fallback
        const fallback = await this.getChunkFallback(id, i);
        if (fallback !== null) {
          results.push(fallback);
        }
      }
    }
    return results;
  }

  async clearTransfer(id: string): Promise<void> {
    const meta = await this.getMeta(id);
    const keysToRemove: string[] = [this.metaKey(id)];

    if (meta) {
      for (let i = 0; i < meta.totalChunks; i++) {
        keysToRemove.push(this.chunkKey(id, i));
      }
    }

    await this.sessionArea.remove(keysToRemove);
    await this.clearChunkFallback(id);
  }

  // ─── Helpers ────────────────────────────────────────────────────

  private async getMeta(
    id: string,
  ): Promise<{ totalChunks: number; totalSize: number } | null> {
    const key = this.metaKey(id);
    const stored = await this.sessionArea.get(key);
    return (stored[key] as { totalChunks: number; totalSize: number } | undefined) ?? null;
  }

  // ─── IndexedDB Fallback ─────────────────────────────────────────

  private get fallbackDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('AiReaderChunkCache', 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore('chunks');
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  private async setChunkFallback(
    id: string,
    index: number,
    data: string,
  ): Promise<void> {
    const db = await this.fallbackDb;
    return new Promise((resolve, reject) => {
      const tx = db.transaction('chunks', 'readwrite');
      const store = tx.objectStore('chunks');
      store.put(data, `${id}:${index}`);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  private async getChunkFallback(
    id: string,
    index: number,
  ): Promise<string | null> {
    const db = await this.fallbackDb;
    return new Promise((resolve, reject) => {
      const tx = db.transaction('chunks', 'readonly');
      const store = tx.objectStore('chunks');
      const request = store.get(`${id}:${index}`);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error);
    });
  }

  private async clearChunkFallback(id: string): Promise<void> {
    const db = await this.fallbackDb;
    const meta = await this.getMeta(id);
    if (!meta) return;

    return new Promise((resolve, reject) => {
      const tx = db.transaction('chunks', 'readwrite');
      const store = tx.objectStore('chunks');
      for (let i = 0; i < meta.totalChunks; i++) {
        store.delete(`${id}:${i}`);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}

export const chunkCache = new SessionChunkCache();
