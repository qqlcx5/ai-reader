import { db } from '../index'
import type { DocumentEntity } from '../../types/document'

export const DocumentRepository = {
  async findById(id: string): Promise<DocumentEntity | undefined> {
    return db.documents.get(id)
  },

  async findByUrl(url: string): Promise<DocumentEntity | undefined> {
    return db.documents.where('url').equals(url).first()
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
}
