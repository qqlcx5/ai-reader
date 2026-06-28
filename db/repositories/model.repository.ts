import { db } from '../index'
import type { ModelConfig } from '../../types/model'
import type { IRepository } from '../repository'

export const ModelRepository: IRepository<ModelConfig> & {
  findEnabled(): Promise<ModelConfig[]>
  findDefault(): Promise<ModelConfig | undefined>
  setDefault(id: string): Promise<void>
  updateLastUsedAt(id: string): Promise<void>
} = {
  async findById(id: string): Promise<ModelConfig | undefined> {
    return db.models.get(id)
  },

  async findAll(): Promise<ModelConfig[]> {
    return db.models.orderBy('updatedAt').reverse().toArray()
  },

  async findEnabled(): Promise<ModelConfig[]> {
    return db.models.where('enabled').equals(1).toArray()
  },

  async findDefault(): Promise<ModelConfig | undefined> {
    return db.models.where('isDefault').equals(1).first()
  },

  async setDefault(id: string): Promise<void> {
    await db.transaction('rw', db.models, async () => {
      const all = await db.models.toArray()
      for (const m of all) {
        if (m.isDefault && m.id !== id) {
          await db.models.update(m.id, { isDefault: false, updatedAt: new Date().toISOString() })
        }
      }
      await db.models.update(id, { isDefault: true, updatedAt: new Date().toISOString() })
    })
  },

  async updateLastUsedAt(id: string): Promise<void> {
    await db.models.update(id, { lastUsedAt: new Date().toISOString() })
  },

  async save(model: ModelConfig): Promise<ModelConfig> {
    await db.models.put(model)
    return model
  },

  async delete(id: string): Promise<void> {
    await db.models.delete(id)
  },

  async count(): Promise<number> {
    return db.models.count()
  },
}
