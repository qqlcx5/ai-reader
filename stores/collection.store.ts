import dayjs from 'dayjs'
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { CollectionRepository } from '../db/repositories/collection.repository'
import type { CollectionEntity } from '../types/collection'

function uuid(): string {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

export const useCollectionStore = defineStore('collection', () => {
  const collections = ref<CollectionEntity[]>([])
  const selectedCollectionId = ref<string | null>(null)
  // collectionId -> ordered document ids
  const docIdsByCollection = ref<Record<string, string[]>>({})

  const selectedCollection = computed(
    () => collections.value.find((c) => c.id === selectedCollectionId.value) ?? null,
  )
  const selectedDocIds = computed(() =>
    selectedCollectionId.value ? docIdsByCollection.value[selectedCollectionId.value] ?? [] : [],
  )
  const counts = computed(() => {
    const m: Record<string, number> = {}
    for (const c of collections.value) m[c.id] = docIdsByCollection.value[c.id]?.length ?? 0
    return m
  })

  function isMember(collectionId: string, documentId: string): boolean {
    return docIdsByCollection.value[collectionId]?.includes(documentId) ?? false
  }

  async function loadCollections() {
    collections.value = await CollectionRepository.findAll()
    const map: Record<string, string[]> = {}
    for (const c of collections.value) {
      map[c.id] = await CollectionRepository.getDocumentIds(c.id)
    }
    docIdsByCollection.value = map
    if (selectedCollectionId.value && !collections.value.some((c) => c.id === selectedCollectionId.value)) {
      selectedCollectionId.value = null
    }
  }

  async function createCollection(name: string, description?: string): Promise<CollectionEntity> {
    const now = dayjs().toISOString()
    const collection: CollectionEntity = {
      id: uuid(),
      name: name.trim() || '未命名合集',
      description: description?.trim() || undefined,
      createdAt: now,
      updatedAt: now,
    }
    await CollectionRepository.save(collection)
    await loadCollections()
    return collection
  }

  async function renameCollection(id: string, name: string): Promise<void> {
    const current = await CollectionRepository.findById(id)
    if (!current) return
    await CollectionRepository.save({
      ...current,
      name: name.trim() || current.name,
      updatedAt: dayjs().toISOString(),
    })
    await loadCollections()
  }

  async function deleteCollection(id: string): Promise<void> {
    await CollectionRepository.delete(id)
    if (selectedCollectionId.value === id) selectedCollectionId.value = null
    await loadCollections()
  }

  async function addDocument(collectionId: string, documentId: string): Promise<void> {
    await CollectionRepository.addDocument(collectionId, documentId)
    docIdsByCollection.value = {
      ...docIdsByCollection.value,
      [collectionId]: await CollectionRepository.getDocumentIds(collectionId),
    }
  }

  async function removeDocument(collectionId: string, documentId: string): Promise<void> {
    await CollectionRepository.removeDocument(collectionId, documentId)
    docIdsByCollection.value = {
      ...docIdsByCollection.value,
      [collectionId]: await CollectionRepository.getDocumentIds(collectionId),
    }
  }

  function selectCollection(id: string) {
    selectedCollectionId.value = selectedCollectionId.value === id ? null : id
  }

  function clearSelection() {
    selectedCollectionId.value = null
  }

  return {
    collections,
    selectedCollectionId,
    selectedCollection,
    selectedDocIds,
    counts,
    isMember,
    loadCollections,
    createCollection,
    renameCollection,
    deleteCollection,
    addDocument,
    removeDocument,
    selectCollection,
    clearSelection,
  }
})
