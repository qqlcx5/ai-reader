import { db } from '../index'
import type { PromptTemplate } from '../../types/prompt-template'
import type { IRepository } from '../repository'

export const PromptTemplateRepository: IRepository<PromptTemplate> & {
  findByCategory(category: string): Promise<PromptTemplate[]>
} = {
  async findById(id: string): Promise<PromptTemplate | undefined> {
    return db.promptTemplates.get(id)
  },

  async findAll(): Promise<PromptTemplate[]> {
    return db.promptTemplates.orderBy('sortOrder').toArray()
  },

  async findByCategory(category: string): Promise<PromptTemplate[]> {
    return db.promptTemplates.where('category').equals(category).sortBy('sortOrder')
  },

  async save(template: PromptTemplate): Promise<PromptTemplate> {
    await db.promptTemplates.put(template)
    return template
  },

  async delete(id: string): Promise<void> {
    await db.promptTemplates.delete(id)
  },

  async count(): Promise<number> {
    return db.promptTemplates.count()
  },
}
