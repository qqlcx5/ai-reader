import MiniSearch from 'minisearch';
import Dexie from 'dexie';

interface Document {
  id: string;
  title: string;
  url: string;
  markdownContent: string;
  createdAt: number;
}

// Worker 内独立创建 Dexie 实例
const db = new Dexie('ReadChatDB');
db.version(1).stores({
  documents: 'id, url, title, createdAt, updatedAt',
  chatHistories: 'id, documentId, createdAt, updatedAt',
  settings: 'key, updatedAt',
});

let miniSearch: MiniSearch | null = null;
let isReady = false;

function createIndex(): MiniSearch {
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
  const docs = await (db as any).documents.toArray();
  miniSearch = createIndex();

  const items = docs.map((d: Document) => ({
    id: d.id,
    title: d.title,
    markdownContent: d.markdownContent?.slice(0, 10000) || '', // 截断以控制索引大小
    url: d.url,
    createdAt: d.createdAt,
  }));

  miniSearch.addAll(items);
  isReady = true;
  self.postMessage({ type: 'INDEX_READY' });
}

async function upsertDocument(documentId: string) {
  if (!miniSearch) return;
  const doc = await (db as any).documents.get(documentId);
  if (!doc) return;

  try {
    miniSearch.discard(documentId);
  } catch {
    // not in index yet
  }

  miniSearch.add({
    id: doc.id,
    title: doc.title,
    markdownContent: doc.markdownContent?.slice(0, 10000) || '',
    url: doc.url,
    createdAt: doc.createdAt,
  });
}

function removeDocument(documentId: string) {
  if (!miniSearch) return;
  try {
    miniSearch.discard(documentId);
  } catch {
    // not in index
  }
}

function search(query: string, requestId: string) {
  if (!miniSearch) {
    self.postMessage({
      type: 'SEARCH_RESULT',
      requestId,
      results: [],
      error: 'Index not ready',
    });
    return;
  }

  const results = miniSearch.search(query, { limit: 50 });
  self.postMessage({
    type: 'SEARCH_RESULT',
    requestId,
    results: results.map((r) => ({
      id: r.id,
      title: r.title as string,
      url: r.url as string,
      score: r.score,
      createdAt: r.createdAt as number,
    })),
  });
}

self.onmessage = async (event: MessageEvent) => {
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
