/**
 * 搜索索引 Web Worker
 * 参考 doc/tasks/search.md 章节 2
 * 使用 MiniSearch + Dexie 在独立线程维护索引
 */
import MiniSearch from 'minisearch';
import Dexie, { type Table } from 'dexie';
import type { CapturedDocument, SearchResult } from '@/shared/types';

interface MessageRequest {
  type: string;
  payload?: Record<string, unknown>;
}

interface DocRow {
  id: string;
  url: string;
  title: string;
  markdownContent: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
}

class WorkerDB extends Dexie {
  documents!: Table<DocRow, string>;
  constructor() {
    super('ReadChatDB');
    this.version(1).stores({
      documents: 'id, url, title, createdAt, updatedAt',
    });
  }
}

const db = new WorkerDB();

const miniSearch = new MiniSearch<DocRow>({
  fields: ['title', 'markdownContent', 'description'],
  storeFields: ['id', 'title', 'url', 'createdAt', 'description'],
  searchOptions: {
    boost: { title: 3, markdownContent: 1 },
    fuzzy: 0.2,
    prefix: true,
  },
});

let initialized = false;

async function initIndex(): Promise<void> {
  const all = await db.documents.toArray();
  miniSearch.removeAll();
  miniSearch.addAll(
    all.map((d) => ({
      ...d,
      // MiniSearch 需要每个字段存在
      markdownContent: d.markdownContent || '',
      description: d.description || '',
    }))
  );
  initialized = true;
  postMessage({ type: 'INDEX_READY', count: all.length });
}

async function upsertDocument(documentId: string): Promise<void> {
  const doc = await db.documents.get(documentId);
  if (!doc) {
    miniSearch.discard(documentId);
    return;
  }
  const docWithDefaults = {
    ...doc,
    markdownContent: doc.markdownContent || '',
    description: doc.description || '',
  };
  if (miniSearch.has(documentId)) {
    miniSearch.replace(docWithDefaults);
  } else {
    miniSearch.add(docWithDefaults);
  }
}

async function removeDocument(documentId: string): Promise<void> {
  if (miniSearch.has(documentId)) {
    miniSearch.discard(documentId);
  }
}

function doSearch(query: string, limit: number, queryId: string): void {
  try {
    const raw = miniSearch.search(query).slice(0, limit);
    const results: SearchResult[] = raw.map((r) => ({
      id: r.id as string,
      title: r.title as string,
      url: r.url as string,
      createdAt: r.createdAt as number,
      score: r.score,
      snippet: ((r as Record<string, unknown>).description as string) ||
        ((r as unknown as { markdownContent?: string }).markdownContent?.slice(0, 200)) ||
        '',
      matches: Object.keys(r.match ?? {}),
    }));
    postMessage({ type: 'SEARCH_RESULT', results, queryId });
  } catch (err) {
    postMessage({
      type: 'SEARCH_RESULT',
      results: [],
      queryId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

self.addEventListener('message', async (e: MessageEvent<MessageRequest>) => {
  const { type, payload = {} } = e.data;

  try {
    switch (type) {
      case 'INIT_INDEX':
        await initIndex();
        break;
      case 'UPSERT_DOCUMENT':
        if (!initialized) await initIndex();
        await upsertDocument(payload.documentId as string);
        break;
      case 'REMOVE_DOCUMENT':
        await removeDocument(payload.documentId as string);
        break;
      case 'SEARCH':
        if (!initialized) await initIndex();
        doSearch(
          payload.query as string,
          (payload.limit as number) || 20,
          payload.queryId as string
        );
        break;
      default:
        console.warn('[search.worker] unknown message type:', type);
    }
  } catch (err) {
    postMessage({
      type: 'ERROR',
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

// 让 TypeScript 把这个文件识别为 module
export {};
