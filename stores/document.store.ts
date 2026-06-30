import { defineStore } from 'pinia'
import { ref } from 'vue'
import { DocumentRepository } from '../db/repositories/document.repository'
import { addToIndex, removeFromIndex, replaceInIndex, initSearchIndex } from '../services/search'
import type { DocumentEntity, LibrarySortKey } from '../types/document'

export const useDocumentStore = defineStore('document', () => {
  const currentDocument = ref<DocumentEntity | null>(null)
  const pageDocument = ref<DocumentEntity | null>(null)
  const documents = ref<DocumentEntity[]>([])
  const isLoading = ref(false)

  // Library list sort preference (persisted).
  const librarySortKey = ref<LibrarySortKey>('viewed')

  function setCurrentDocument(doc: DocumentEntity | null) {
    currentDocument.value = doc
  }

  function setPageDocument(doc: DocumentEntity | null) {
    pageDocument.value = doc
  }

  function setLibrarySortKey(key: LibrarySortKey) {
    librarySortKey.value = key
  }

  async function loadDocument(id: string) {
    isLoading.value = true
    try {
      const doc = await DocumentRepository.findById(id)
      if (doc) currentDocument.value = doc
    } finally {
      isLoading.value = false
    }
  }

  /** Mark a document as opened now (drives "recently viewed" sort + unread dot). */
  async function markOpened(id: string) {
    const now = new Date().toISOString()
    try {
      await DocumentRepository.touchLastOpened(id, now)
    } catch (err) {
      console.error('[document.store] markOpened failed for', id, err)
      return
    }
    const inList = documents.value.find((d) => d.id === id)
    if (inList) inList.lastOpenedAt = now
    if (currentDocument.value?.id === id) currentDocument.value.lastOpenedAt = now
  }

  async function saveDocument(doc: DocumentEntity) {
    const saved = await DocumentRepository.save(doc)
    try {
      replaceInIndex(saved)
    } catch (err) {
      console.error('[document.store] replaceInIndex failed for', saved.id, err)
    }
    // If URL-based dedup merged into an existing document (different id),
    // sync the in-memory refs so currentDocument / pageDocument point to
    // the correct merged record.
    if (currentDocument.value && currentDocument.value.url === saved.url && currentDocument.value.id !== saved.id) {
      currentDocument.value = saved
    }
    if (pageDocument.value && pageDocument.value.url === saved.url && pageDocument.value.id !== saved.id) {
      pageDocument.value = saved
    }
  }

  async function deleteDocument(id: string) {
    await DocumentRepository.delete(id)
    removeFromIndex(id)
    if (currentDocument.value?.id === id) currentDocument.value = null
    if (pageDocument.value?.id === id) pageDocument.value = null
  }

  async function refreshDocuments() {
    documents.value = await DocumentRepository.findAll()
  }

  // Initialize search index on first use
  initSearchIndex().catch(() => {
    // non-critical; index will be built on next add
  })

  return {
    currentDocument,
    pageDocument,
    documents,
    isLoading,
    librarySortKey,
    setCurrentDocument,
    setPageDocument,
    setLibrarySortKey,
    loadDocument,
    saveDocument,
    deleteDocument,
    markOpened,
    refreshDocuments,
  }
}, {
  persist: {
    pick: ['librarySortKey'],
  },
})
