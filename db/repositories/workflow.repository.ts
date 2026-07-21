import { db } from '../index'
import type { WorkflowEntity } from '../../types/workflow'

export const WorkflowRepository = {
  async findById(id: string): Promise<WorkflowEntity | undefined> {
    return db.workflows.get(id)
  },

  async findAll(): Promise<WorkflowEntity[]> {
    return db.workflows.orderBy('createdAt').toArray()
  },

  async findEnabled(): Promise<WorkflowEntity[]> {
    // ponytail: boolean index fallback — dexie indexes booleans inconsistently
    // across versions; in-memory filter is fine for expected single-digit counts.
    const all = await db.workflows.toArray()
    return all
      .filter((w) => w.enabled)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
  },

  async save(workflow: WorkflowEntity): Promise<WorkflowEntity> {
    await db.workflows.put(workflow)
    return workflow
  },

  async delete(id: string): Promise<void> {
    await db.workflows.delete(id)
  },
}
