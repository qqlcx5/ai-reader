import { db } from '../index'
import type { ModelConfig } from '../../types/model'

export const ModelRepository = {
  async findById(id: string): Promise<ModelConfig | undefined> {
    return db.models.get(id)
  },

  async findAll(): Promise<ModelConfig[]> {
    return db.models.orderBy('updatedAt').reverse().toArray()
  },

  async findDefault(): Promise<ModelConfig | undefined> {
    return db.models.where('isDefault').equals(1).first()
  },

  async save(model: ModelConfig): Promise<string> {
    await db.models.put(model)
    return model.id
  },

  async delete(id: string): Promise<void> {
    await db.models.delete(id)
  },
}
