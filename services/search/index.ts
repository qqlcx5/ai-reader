import MiniSearch from 'minisearch'
import { DocumentRepository } from '../../db/repositories/document.repository'
import type { DocumentEntity } from '../../types/document'

export const searchIndex = new MiniSearch<{ id: string; title: string; url: string; siteName: string; markdown: string; excerpt: string }>({
  fields: ['title', 'url', 'siteName', 'markdown', 'excerpt'],
  storeFields: ['id'],
  searchOptions: {
    boost: { title: 3, siteName: 2, markdown: 1 },
    prefix: true,
    fuzzy: 0.2,
  },
})

function toIndexDoc(doc: DocumentEntity) {
  return {
    id: doc.id,
    title: doc.title || '',
    url: doc.url || '',
    siteName: doc.siteName || '',
    markdown: doc.markdown || '',
    excerpt: doc.excerpt || '',
  }
}

export async function initSearchIndex(): Promise<void> {
  const allDocs = await DocumentRepository.findAll()
  searchIndex.removeAll()
  if (allDocs.length > 0) {
    const docs = allDocs.map(toIndexDoc)
    await searchIndex.addAllAsync(docs)
  }
}

export function addToIndex(doc: DocumentEntity): void {
  searchIndex.add(toIndexDoc(doc))
}

export function removeFromIndex(id: string): void {
  // discard() throws when the id isn't in the index — e.g. the async
  // addAllAsync init hasn't finished yet, or the doc entered via sync/import
  // without being added to the in-memory index. Removing a non-indexed doc is
  // a no-op. Without this guard, deleteDocument() throws and the caller's
  // (confirmDelete) await chain aborts before it can close the modal / refresh.
  if (searchIndex.has(id)) searchIndex.discard(id)
}

export function replaceInIndex(doc: DocumentEntity): void {
  removeFromIndex(doc.id)
  addToIndex(doc)
}

export function searchDocuments(query: string): Array<{ id: string }> {
  if (!query.trim()) return []
  const results = searchIndex.search(query)
  return results.map((r) => ({ id: r.id }))
}
