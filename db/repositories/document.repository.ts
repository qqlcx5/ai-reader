import { db } from '../index'
import type { DocumentEntity } from '../../types/document'
import type { IRepository } from '../repository'

export const DocumentRepository: IRepository<DocumentEntity> & {
  findByUrl(url: string): Promise<DocumentEntity | undefined>
  findByDateRange(start: string, end: string): Promise<DocumentEntity[]>
  findPaginated(offset: number, limit: number): Promise<DocumentEntity[]>
  save(doc: DocumentEntity): Promise<string>
} = {
  async findById(id: string): Promise<DocumentEntity | undefined> {
    return db.documents.get(id)
  },

  async findByUrl(url: string): Promise<DocumentEntity | undefined> {
    return db.documents.where('url').equals(url).first()
  },

  async findByDateRange(start: string, end: string): Promise<DocumentEntity[]> {
    return db.documents
      .where('capturedAt')
      .between(start, end, true, true)
      .toArray()
  },

  async findPaginated(offset: number, limit: number): Promise<DocumentEntity[]> {
    return db.documents
      .orderBy('capturedAt')
      .reverse()
      .offset(offset)
      .limit(limit)
      .toArray()
  },

  async findAll(): Promise<DocumentEntity[]> {
    return db.documents.orderBy('capturedAt').reverse().toArray()
  },

  async save(doc: DocumentEntity): Promise<string> {
    await db.documents.put(doc)
    return doc.id
  },

  async delete(id: string): Promise<void> {
    await db.documents.delete(id)
  },

  async count(): Promise<number> {
    return db.documents.count()
  },
}
