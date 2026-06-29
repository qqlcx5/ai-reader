import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../index'
import { CollectionRepository } from './collection.repository'
import type { CollectionEntity } from '../../types/collection'

function makeCollection(name: string): CollectionEntity {
  const now = new Date().toISOString()
  return { id: `c-${name}`, name, createdAt: now, updatedAt: now }
}

describe('CollectionRepository', () => {
  beforeEach(async () => {
    await db.collectionItems.clear()
    await db.collections.clear()
  })

  it('saves and lists collections', async () => {
    await CollectionRepository.save(makeCollection('Research'))
    const all = await CollectionRepository.findAll()
    expect(all).toHaveLength(1)
    expect(all[0].name).toBe('Research')
  })

  it('adds documents in insertion order and dedupes', async () => {
    await CollectionRepository.save(makeCollection('C'))
    const id = 'c-C'
    await CollectionRepository.addDocument(id, 'doc-1')
    await CollectionRepository.addDocument(id, 'doc-2')
    await CollectionRepository.addDocument(id, 'doc-1') // duplicate -> no-op
    expect(await CollectionRepository.getDocumentIds(id)).toEqual(['doc-1', 'doc-2'])
    expect(await CollectionRepository.countItems(id)).toBe(2)
    expect(await CollectionRepository.isMember(id, 'doc-1')).toBe(true)
    expect(await CollectionRepository.isMember(id, 'doc-3')).toBe(false)
  })

  it('removes a document from a collection', async () => {
    await CollectionRepository.save(makeCollection('C'))
    await CollectionRepository.addDocument('c-C', 'doc-1')
    await CollectionRepository.addDocument('c-C', 'doc-2')
    await CollectionRepository.removeDocument('c-C', 'doc-1')
    expect(await CollectionRepository.getDocumentIds('c-C')).toEqual(['doc-2'])
  })

  it('deletes a collection and cascades its items', async () => {
    await CollectionRepository.save(makeCollection('C'))
    await CollectionRepository.addDocument('c-C', 'doc-1')
    await CollectionRepository.delete('c-C')
    expect(await CollectionRepository.findAll()).toHaveLength(0)
    expect(await CollectionRepository.getDocumentIds('c-C')).toEqual([])
  })
})
