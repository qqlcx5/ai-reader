import dayjs from 'dayjs'
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
    const models = await db.models.toArray()
    return models.sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
    )
  },

  async findEnabled(): Promise<ModelConfig[]> {
    return db.models.where('enabled').equals(1).toArray()
  },

  async findDefault(): Promise<ModelConfig | undefined> {
    // Boolean indexes are inconsistent across IndexedDB implementations.
    return (await db.models.toArray()).find((model) => model.isDefault)
  },

  async setDefault(id: string): Promise<void> {
    await db.transaction('rw', db.models, async () => {
      const all = await db.models.toArray()
      for (const m of all) {
        if (m.isDefault && m.id !== id) {
          await db.models.update(m.id, { isDefault: false, updatedAt: dayjs().toISOString() })
        }
      }
      await db.models.update(id, { isDefault: true, updatedAt: dayjs().toISOString() })
    })
  },

  async updateLastUsedAt(id: string): Promise<void> {
    await db.models.update(id, { lastUsedAt: dayjs().toISOString() })
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
