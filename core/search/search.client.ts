import type { SearchResult } from '@/db/schema';

type SearchCallback = (results: SearchResult[]) => void;
type ReadyCallback = () => void;

// 内联 Worker 代码，避免路径解析问题
const WORKER_CODE = `
  import MiniSearch from 'minisearch';
  import Dexie from 'dexie';

  const db = new Dexie('ReadChatDB');
  db.version(1).stores({
    documents: 'id, url, title, createdAt, updatedAt',
    chatHistories: 'id, documentId, createdAt, updatedAt',
    settings: 'key, updatedAt',
  });

  let miniSearch = null;
  let isReady = false;

  function createIndex() {
    return new MiniSearch({
      fields: ['title', 'markdownContent'],
      storeFields: ['id', 'title', 'url', 'createdAt'],
      searchOptions: {
        boost: { title: 3, markdownContent: 1 },
        fuzzy: 0.2,
        prefix: true,
      },
    });
  }

  async function initIndex() {
    const docs = await db.documents.toArray();
    miniSearch = createIndex();

    const items = docs.map(d => ({
      id: d.id,
      title: d.title,
      markdownContent: d.markdownContent?.slice(0, 10000) || '',
      url: d.url,
      createdAt: d.createdAt,
    }));

    miniSearch.addAll(items);
    isReady = true;
    self.postMessage({ type: 'INDEX_READY' });
  }

  async function upsertDocument(documentId) {
    if (!miniSearch) return;
    const doc = await db.documents.get(documentId);
    if (!doc) return;

    try { miniSearch.discard(documentId); } catch {}
    miniSearch.add({
      id: doc.id,
      title: doc.title,
      markdownContent: doc.markdownContent?.slice(0, 10000) || '',
      url: doc.url,
      createdAt: doc.createdAt,
    });
  }

  function removeDocument(documentId) {
    if (!miniSearch) return;
    try { miniSearch.discard(documentId); } catch {}
  }

  function search(query, requestId) {
    if (!miniSearch) {
      self.postMessage({ type: 'SEARCH_RESULT', requestId, results: [], error: 'Index not ready' });
      return;
    }

    const results = miniSearch.search(query, { limit: 50 });
    self.postMessage({
      type: 'SEARCH_RESULT',
      requestId,
      results: results.map(r => ({
        id: r.id,
        title: r.title,
        url: r.url,
        score: r.score,
        createdAt: r.createdAt,
      })),
    });
  }

  self.onmessage = async (event) => {
    const msg = event.data;
    switch (msg.type) {
      case 'INIT_INDEX':
        await initIndex();
        break;
      case 'UPSERT_DOCUMENT':
        await upsertDocument(msg.documentId);
        break;
      case 'REMOVE_DOCUMENT':
        removeDocument(msg.documentId);
        break;
      case 'SEARCH':
        search(msg.query, msg.requestId);
        break;
    }
  };
`;

export class SearchClient {
  private worker: Worker | null = null;
  private pendingRequests = new Map<string, SearchCallback>();
  private onReadyCallbacks: ReadyCallback[] = [];
  private ready = false;

  constructor() {
    this.initWorker();
  }

  private initWorker() {
    try {
      const blob = new Blob([WORKER_CODE], { type: 'application/javascript' });
      const url = URL.createObjectURL(blob);
      this.worker = new Worker(url, { type: 'module' });

      this.worker.onmessage = (event: MessageEvent) => {
        const msg = event.data;

        if (msg.type === 'INDEX_READY') {
          this.ready = true;
          for (const cb of this.onReadyCallbacks) cb();
          this.onReadyCallbacks = [];
        } else if (msg.type === 'SEARCH_RESULT') {
          const cb = this.pendingRequests.get(msg.requestId);
          if (cb) {
            cb(msg.results || []);
            this.pendingRequests.delete(msg.requestId);
          }
        }
      };

      this.worker.onerror = (err) => {
        console.error('Search worker error:', err);
        // 降级：设置为 ready，搜索时使用 Dexie fallback
        this.ready = true;
        for (const cb of this.onReadyCallbacks) cb();
        this.onReadyCallbacks = [];
      };
    } catch (err) {
      console.error('Failed to create search worker:', err);
      this.ready = true;
    }
  }

  init(): void {
    this.worker?.postMessage({ type: 'INIT_INDEX' });
  }

  onReady(callback: ReadyCallback): void {
    if (this.ready) {
      callback();
    } else {
      this.onReadyCallbacks.push(callback);
    }
  }

  async search(query: string): Promise<SearchResult[]> {
    if (!this.worker || !this.ready) return [];

    return new Promise((resolve) => {
      const requestId = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
      this.pendingRequests.set(requestId, (results) => resolve(results));
      this.worker!.postMessage({ type: 'SEARCH', query, requestId });

      setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          resolve([]);
        }
      }, 5000);
    });
  }

  upsert(documentId: string): void {
    this.worker?.postMessage({ type: 'UPSERT_DOCUMENT', documentId });
  }

  remove(documentId: string): void {
    this.worker?.postMessage({ type: 'REMOVE_DOCUMENT', documentId });
  }

  isReady(): boolean {
    return this.ready;
  }

  destroy(): void {
    this.worker?.terminate();
    this.worker = null;
  }
}

let instance: SearchClient | null = null;

export function getSearchClient(): SearchClient {
  if (!instance) {
    instance = new SearchClient();
    instance.init();
  }
  return instance;
}
