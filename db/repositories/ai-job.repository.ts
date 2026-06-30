import { db } from '../index'
import type { AiJobEntity, AiJobStatus } from '../../types/ai-job'

export const AiJobRepository = {
  async findById(id: string): Promise<AiJobEntity | undefined> {
    return db.aiJobs.get(id)
  },

  async findByDocument(documentId: string): Promise<AiJobEntity[]> {
    return db.aiJobs.where('documentId').equals(documentId).toArray()
  },

  async findPending(): Promise<AiJobEntity[]> {
    const rows = await db.aiJobs.where('status').equals('pending').toArray()
    return rows.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
  },

  async findAll(): Promise<AiJobEntity[]> {
    return db.aiJobs.orderBy('createdAt').reverse().toArray()
  },

  async save(job: AiJobEntity): Promise<AiJobEntity> {
    await db.aiJobs.put(job)
    return job
  },

  async setStatus(
    id: string,
    status: AiJobStatus,
    extra: { conversationId?: string; error?: string; finishedAt?: string } = {},
  ): Promise<void> {
    await db.aiJobs.update(id, { status, ...extra })
  },

  async countByStatus(status: AiJobStatus): Promise<number> {
    return db.aiJobs.where('status').equals(status).count()
  },

  async delete(id: string): Promise<void> {
    await db.aiJobs.delete(id)
  },

  async deleteByStatus(status: AiJobStatus): Promise<void> {
    await db.aiJobs.where('status').equals(status).delete()
  },
}
