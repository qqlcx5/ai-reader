import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useDocumentStore } from './document.store'
import { db } from '../db'
import { DocumentRepository } from '../db/repositories/document.repository'
import { ChatRepository } from '../db/repositories/chat.repository'
import { CollectionRepository } from '../db/repositories/collection.repository'
import type { DocumentEntity } from '../types/document'
import type { ConversationEntity } from '../types/chat'
import type { CollectionEntity } from '../types/collection'

describe('stores/document.store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('should initialize with null documents', () => {
    const store = useDocumentStore()
    expect(store.currentDocument).toBeNull()
    expect(store.pageDocument).toBeNull()
    expect(store.documents).toEqual([])
  })

  it('should set current document directly', () => {
    const store = useDocumentStore()
    const doc = {
      id: '1',
      url: 'https://example.com',
      title: 'Test',
      markdown: '',
      wordCount: 0,
      tokenCount: 0,
      contentHash: 'abc',
      extractionMethod: 'manual' as const,
      source: 'library' as const,
      capturedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    store.setCurrentDocument(doc)
    expect(store.currentDocument?.id).toBe('1')
  })

  it('should set page document directly', () => {
    const store = useDocumentStore()
    const doc = {
      id: '2',
      url: 'https://example.com/page',
      title: 'Page',
      markdown: 'test',
      wordCount: 1,
      tokenCount: 1,
      contentHash: 'def',
      extractionMethod: 'defuddle' as const,
      source: 'current-page' as const,
      capturedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    store.setPageDocument(doc)
    expect(store.pageDocument?.id).toBe('2')
  })
})

describe('stores/document.store – deleteDocument cascade', () => {
  beforeEach(async () => {
    setActivePinia(createPinia())
    await db.documents.clear()
    await db.conversations.clear()
    await db.collections.clear()
    await db.collectionItems.clear()
  })

  async function seedDoc(id: string): Promise<DocumentEntity> {
    const now = new Date().toISOString()
    const doc: DocumentEntity = {
      id,
      url: `https://example.com/${id}`,
      title: `Doc ${id}`,
      markdown: '# Hello',
      wordCount: 1,
      tokenCount: 1,
      contentHash: `hash-${id}`,
      extractionMethod: 'defuddle',
      source: 'current-page',
      capturedAt: now,
      updatedAt: now,
    }
    await DocumentRepository.save(doc)
    return doc
  }

  async function seedConversation(documentId: string): Promise<void> {
    const now = new Date().toISOString()
    const conv: ConversationEntity = {
      id: `conv-${documentId}`,
      documentId,
      messages: [],
      createdAt: now,
      updatedAt: now,
    }
    await ChatRepository.save(conv)
  }

  async function seedCollection(name: string, docIds: string[]): Promise<CollectionEntity> {
    const now = new Date().toISOString()
    const col: CollectionEntity = {
      id: `col-${name}`,
      name,
      createdAt: now,
      updatedAt: now,
    }
    await CollectionRepository.save(col)
    for (const docId of docIds) {
      await CollectionRepository.addDocument(col.id, docId)
    }
    return col
  }

  it('cascades: deletes conversations and collectionItems on single delete', async () => {
    const doc = await seedDoc('d1')
    await seedConversation('d1')
    const col = await seedCollection('Research', ['d1'])

    // Verify pre-conditions
    expect(await ChatRepository.findByDocumentId('d1')).toHaveLength(1)
    expect(await CollectionRepository.getDocumentIds(col.id)).toEqual(['d1'])

    const store = useDocumentStore()
    await store.deleteDocument('d1')

    // Document gone
    expect(await DocumentRepository.findById('d1')).toBeUndefined()
    // Conversation gone
    expect(await ChatRepository.findByDocumentId('d1')).toHaveLength(0)
    // collectionItems reference gone
    expect(await CollectionRepository.getDocumentIds(col.id)).toEqual([])
  })

  it('cascades: deletes conversations and collectionItems on batch delete', async () => {
    await seedDoc('d1')
    await seedDoc('d2')
    await seedConversation('d1')
    await seedConversation('d2')
    const col = await seedCollection('Batch', ['d1', 'd2'])

    const store = useDocumentStore()
    // Populate documents list so refreshDocuments works
    await store.refreshDocuments()
    store.selectAll(['d1', 'd2'])
    await store.deleteSelectedDocuments()

    expect(await DocumentRepository.findById('d1')).toBeUndefined()
    expect(await DocumentRepository.findById('d2')).toBeUndefined()
    expect(await ChatRepository.findByDocumentId('d1')).toHaveLength(0)
    expect(await ChatRepository.findByDocumentId('d2')).toHaveLength(0)
    expect(await CollectionRepository.getDocumentIds(col.id)).toEqual([])
    expect(store.selectedIds.size).toBe(0)
  })
})
