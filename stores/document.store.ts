import { defineStore } from 'pinia'
import { ref } from 'vue'
import { DocumentRepository } from '../db/repositories/document.repository'
import { ChatRepository } from '../db/repositories/chat.repository'
import { CollectionRepository } from '../db/repositories/collection.repository'
import { addToIndex, removeFromIndex, replaceInIndex, initSearchIndex } from '../services/search'
import type { DocumentEntity, LibrarySortKey } from '../types/document'

export const useDocumentStore = defineStore('document', () => {
  const currentDocument = ref<DocumentEntity | null>(null)
  const pageDocument = ref<DocumentEntity | null>(null)
  const documents = ref<DocumentEntity[]>([])
  const isLoading = ref(false)

  // Library list sort preference (persisted).
  const librarySortKey = ref<LibrarySortKey>('viewed')

  // Persisted document ID so the current document can be restored after
  // window reopen (e.g. sidepanel → popped-out window). The full DocumentEntity
  // is not persisted due to localStorage size limits; the ID is used to
  // re-hydrate from IndexedDB via the afterRestore hook.
  const currentDocumentId = ref<string | null>(null)

  // ── Multi-select state ──
  const selectedIds = ref<Set<string>>(new Set())

  function toggleSelection(id: string) {
    const next = new Set(selectedIds.value)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    selectedIds.value = next
  }

  function selectAll(ids: string[]) {
    selectedIds.value = new Set(ids)
  }

  function clearSelection() {
    selectedIds.value = new Set()
  }

  async function deleteSelectedDocuments() {
    const ids = [...selectedIds.value]
    if (!ids.length) return

    // 1. Cascade-clean collectionItems references
    await CollectionRepository.removeDocumentsFromAllCollections(ids).catch(() => {})
    // 2. Cascade-delete conversations
    await ChatRepository.deleteByDocumentIds(ids).catch(() => {})
    // 3. Bulk-delete documents
    await DocumentRepository.deleteMany(ids)
    // 4. Remove from search index
    for (const id of ids) removeFromIndex(id)
    // 5. Clear current/page refs if affected
    if (currentDocument.value && ids.includes(currentDocument.value.id)) {
      currentDocument.value = null
      currentDocumentId.value = null
    }
    if (pageDocument.value && ids.includes(pageDocument.value.id)) pageDocument.value = null
    // 6. Clear selection and refresh
    selectedIds.value.clear()
    await refreshDocuments()
  }

  function setCurrentDocument(doc: DocumentEntity | null) {
    currentDocument.value = doc
    currentDocumentId.value = doc?.id ?? null
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
      if (doc) {
        currentDocument.value = doc
        currentDocumentId.value = doc.id
      }
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
      currentDocumentId.value = saved.id
    }
    if (pageDocument.value && pageDocument.value.url === saved.url && pageDocument.value.id !== saved.id) {
      pageDocument.value = saved
    }
  }

  async function deleteDocument(id: string) {
    // Cascade-clean collectionItems references
    await CollectionRepository.removeDocumentsFromAllCollections([id]).catch(() => {})
    // Cascade-delete conversations (and their embedded messages)
    await ChatRepository.deleteByDocumentIds([id]).catch(() => {})
    // Delete the document itself
    await DocumentRepository.delete(id)
    removeFromIndex(id)
    if (currentDocument.value?.id === id) {
      currentDocument.value = null
      currentDocumentId.value = null
    }
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
    currentDocumentId,
    selectedIds,
    setCurrentDocument,
    setPageDocument,
    setLibrarySortKey,
    loadDocument,
    saveDocument,
    deleteDocument,
    markOpened,
    refreshDocuments,
    toggleSelection,
    selectAll,
    clearSelection,
    deleteSelectedDocuments,
  }
}, {
  persist: {
    pick: ['librarySortKey', 'currentDocumentId'],
    afterRestore: async (ctx) => {
      const store = ctx.store as ReturnType<typeof useDocumentStore>
      if (store.currentDocumentId) {
        // Re-hydrate the full document from IndexedDB. Silently ignore
        // failures — the ID exists but the document may have been deleted.
        await store.loadDocument(store.currentDocumentId).catch(() => {})
      }
    },
  },
})
