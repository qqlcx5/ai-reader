import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { CapturedDocument } from '@shared/types'
import { db } from '@db/index'

export const useDocumentStore = defineStore('documents', () => {
  // State
  const documents = ref<CapturedDocument[]>([])
  const currentDocument = ref<CapturedDocument | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const totalCount = ref(0)

  // Getters
  const recentDocuments = computed(() => {
    return [...documents.value]
      .sort((a, b) => b.capturedAt - a.capturedAt)
      .slice(0, 50)
  })

  const archivedDocuments = computed(() => {
    return documents.value.filter((doc) => doc.isArchived)
  })

  const documentsBySite = computed(() => {
    const grouped = new Map<string, CapturedDocument[]>()
    documents.value.forEach((doc) => {
      const site = doc.siteName || 'Unknown'
      if (!grouped.has(site)) {
        grouped.set(site, [])
      }
      grouped.get(site)!.push(doc)
    })
    return grouped
  })

  const getDocumentById = computed(() => {
    return (id: string) => documents.value.find((doc) => doc.id === id)
  })

  // Actions
  async function loadDocuments(limit = 100, offset = 0) {
    isLoading.value = true
    error.value = null
    try {
      const docs = await db.documents.limit(limit).offset(offset).toArray()
      documents.value = docs
      totalCount.value = await db.documents.count()
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load documents'
      console.error('Failed to load documents:', err)
    } finally {
      isLoading.value = false
    }
  }

  async function addDocument(doc: CapturedDocument) {
    try {
      await db.documents.put(doc)
      await loadDocuments()
      return doc
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to add document'
      throw err
    }
  }

  async function setCurrentDocument(doc: CapturedDocument | null) {
    currentDocument.value = doc
    if (doc) {
      // Save to chrome.storage for cross-context access
      await chrome.storage.local.set({ 'ai_reader_current_doc': doc })
    }
  }

  async function deleteDocument(id: string) {
    try {
      await db.documents.delete(id)
      await db.chatSessions.where('documentId').equals(id).delete()
      if (currentDocument.value?.id === id) {
        currentDocument.value = null
      }
      await loadDocuments()
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to delete document'
      throw err
    }
  }

  async function archiveDocument(id: string) {
    try {
      await db.documents.update(id, { isArchived: true })
      await loadDocuments()
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to archive document'
      throw err
    }
  }

  async function updateDocument(id: string, updates: Partial<CapturedDocument>) {
    try {
      await db.documents.update(id, { ...updates, updatedAt: Date.now() })
      await loadDocuments()
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to update document'
      throw err
    }
  }

  async function searchDocuments(query: string): Promise<CapturedDocument[]> {
    try {
      const allDocs = await db.documents.toArray()
      const lowerQuery = query.toLowerCase()
      return allDocs.filter(
        (doc) =>
          doc.title.toLowerCase().includes(lowerQuery) ||
          doc.content.toLowerCase().includes(lowerQuery) ||
          doc.siteName?.toLowerCase().includes(lowerQuery)
      )
    } catch (err) {
      console.error('Failed to search documents:', err)
      return []
    }
  }

  return {
    documents,
    currentDocument,
    isLoading,
    error,
    totalCount,
    recentDocuments,
    archivedDocuments,
    documentsBySite,
    getDocumentById,
    loadDocuments,
    addDocument,
    setCurrentDocument,
    deleteDocument,
    archiveDocument,
    updateDocument,
    searchDocuments,
  }
})
