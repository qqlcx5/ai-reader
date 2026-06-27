import { defineStore } from 'pinia'
import { ref } from 'vue'
import { DocumentRepository } from '../db/repositories/document.repository'
import type { DocumentEntity } from '../types/document'

export const useDocumentStore = defineStore('document', () => {
  const currentDocument = ref<DocumentEntity | null>(null)
  const pageDocument = ref<DocumentEntity | null>(null)
  const documents = ref<DocumentEntity[]>([])
  const isLoading = ref(false)

  function setCurrentDocument(doc: DocumentEntity | null) {
    currentDocument.value = doc
  }

  function setPageDocument(doc: DocumentEntity | null) {
    pageDocument.value = doc
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

  async function saveDocument(doc: DocumentEntity) {
    await DocumentRepository.save(doc)
  }

  async function deleteDocument(id: string) {
    await DocumentRepository.delete(id)
    if (currentDocument.value?.id === id) currentDocument.value = null
    if (pageDocument.value?.id === id) pageDocument.value = null
  }

  async function refreshDocuments() {
    documents.value = await DocumentRepository.findAll()
  }

  return {
    currentDocument,
    pageDocument,
    documents,
    isLoading,
    setCurrentDocument,
    setPageDocument,
    loadDocument,
    saveDocument,
    deleteDocument,
    refreshDocuments,
  }
})
