import dayjs from 'dayjs'
import { db } from '../index'
import type { AiJobEntity, AiJobStatus, AiJobFilter, AiJobStats, AiJobPriority } from '../../types/ai-job'
import { PRIORITY_WEIGHT } from '../../types/ai-job'

export const AiJobRepository = {
  async findById(id: string): Promise<AiJobEntity | undefined> {
    return db.aiJobs.get(id)
  },

  async findByDocument(documentId: string): Promise<AiJobEntity[]> {
    return db.aiJobs.where('documentId').equals(documentId).toArray()
  },

  async findByBatchId(batchId: string): Promise<AiJobEntity[]> {
    return db.aiJobs.where('batchId').equals(batchId).toArray()
  },

  /** Fetch pending jobs sorted by priority (desc) then sortOrder (asc) then createdAt (asc). */
  async findPending(): Promise<AiJobEntity[]> {
    const rows = await db.aiJobs.where('status').equals('pending').toArray()
    return rows.sort((a, b) => {
      const pa = PRIORITY_WEIGHT[a.priority ?? 'normal']
      const pb = PRIORITY_WEIGHT[b.priority ?? 'normal']
      if (pb !== pa) return pb - pa
      const sa = a.sortOrder ?? Number.MAX_SAFE_INTEGER
      const sb = b.sortOrder ?? Number.MAX_SAFE_INTEGER
      if (sa !== sb) return sa - sb
      return dayjs(a.createdAt).valueOf() - dayjs(b.createdAt).valueOf()
    })
  },

  async findAll(): Promise<AiJobEntity[]> {
    return db.aiJobs.orderBy('createdAt').reverse().toArray()
  },

  async findByFilter(filter: AiJobFilter): Promise<AiJobEntity[]> {
    let jobs: AiJobEntity[]

    if (filter.status && filter.status !== 'all') {
      jobs = await db.aiJobs.where('status').equals(filter.status).toArray()
    } else {
      jobs = await db.aiJobs.orderBy('createdAt').reverse().toArray()
    }

    if (filter.modelId) {
      jobs = jobs.filter((j) => j.modelId === filter.modelId)
    }
    if (filter.batchId) {
      jobs = jobs.filter((j) => j.batchId === filter.batchId)
    }
    if (filter.search) {
      const q = filter.search.toLowerCase()
      jobs = jobs.filter(
        (j) =>
          j.documentTitle?.toLowerCase().includes(q) ||
          j.error?.toLowerCase().includes(q),
      )
    }

    return jobs.sort((a, b) => dayjs(b.createdAt).valueOf() - dayjs(a.createdAt).valueOf())
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

  async countTotal(): Promise<number> {
    return db.aiJobs.count()
  },

  /** Fetch all jobs with a given status. */
  async findByStatus(status: AiJobStatus): Promise<AiJobEntity[]> {
    return db.aiJobs.where('status').equals(status).toArray()
  },

  /** Partial update a job by id. */
  async savePatch(id: string, patch: Partial<AiJobEntity>): Promise<void> {
    await db.aiJobs.update(id, patch)
  },

  async getStats(): Promise<AiJobStats> {
    const [pending, processing, success, failed, cancelled, all] = await Promise.all([
      db.aiJobs.where('status').equals('pending').count(),
      db.aiJobs.where('status').equals('processing').count(),
      db.aiJobs.where('status').equals('success').count(),
      db.aiJobs.where('status').equals('failed').count(),
      db.aiJobs.where('status').equals('cancelled').count(),
      db.aiJobs.count(),
    ])

    // Calculate average duration for finished jobs
    const finishedJobs = await db.aiJobs.where('status').anyOf('success', 'failed').toArray()
    let totalDuration = 0
    let durationCount = 0
    for (const job of finishedJobs) {
      if (job.finishedAt && job.createdAt) {
        const dur = dayjs(job.finishedAt).valueOf() - dayjs(job.createdAt).valueOf()
        if (dur > 0 && dur < 7_200_000) { // sanity: < 2h
          totalDuration += dur
          durationCount++
        }
      }
    }

    const total = all
    return {
      total,
      pending,
      processing,
      success,
      failed,
      cancelled,
      successRate: total > 0 ? success / total : 0,
      avgDurationMs: durationCount > 0 ? Math.round(totalDuration / durationCount) : 0,
    }
  },

  async delete(id: string): Promise<void> {
    await db.aiJobs.delete(id)
  },

  async deleteByStatus(status: AiJobStatus): Promise<void> {
    await db.aiJobs.where('status').equals(status).delete()
  },

  async deleteByDocument(documentId: string): Promise<void> {
    await db.aiJobs.where('documentId').equals(documentId).delete()
  },

  async deleteByBatchId(batchId: string): Promise<void> {
    await db.aiJobs.where('batchId').equals(batchId).delete()
  },

  /** Batch-update multiple jobs (e.g. set priority, set status). */
  async batchUpdate(ids: string[], patch: Partial<AiJobEntity>): Promise<void> {
    await db.transaction('rw', db.aiJobs, async () => {
      for (const id of ids) {
        await db.aiJobs.update(id, patch)
      }
    })
  },

  /** Re-assign sortOrder for the given pending job IDs in the given order. */
  async reorderPendingJobs(orderedIds: string[]): Promise<void> {
    await db.transaction('rw', db.aiJobs, async () => {
      for (let i = 0; i < orderedIds.length; i++) {
        await db.aiJobs.update(orderedIds[i], { sortOrder: i })
      }
    })
  },

  /** Delete multiple jobs by ID in a single transaction. */
  async deleteMany(ids: string[]): Promise<void> {
    await db.aiJobs.bulkDelete(ids)
  },
}
