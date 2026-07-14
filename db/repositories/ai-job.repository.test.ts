import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '@/db'
import { AiJobRepository } from './ai-job.repository'

async function resetDB() {
  await db.aiJobs.clear()
}

describe('AiJobRepository', () => {
  beforeEach(async () => {
    await resetDB()
  })

  describe('findPending', () => {
    it('returns pending jobs sorted by priority → sortOrder → createdAt', async () => {
      const now = '2026-01-01T00:00:00Z'
      await AiJobRepository.save({ id: 'j1', documentId: 'd1', modelId: 'm1', promptTemplateId: '', status: 'pending', retries: 0, createdAt: now, priority: 'low' })
      await AiJobRepository.save({ id: 'j2', documentId: 'd2', modelId: 'm1', promptTemplateId: '', status: 'pending', retries: 0, createdAt: now, priority: 'high' })
      await AiJobRepository.save({ id: 'j3', documentId: 'd3', modelId: 'm1', promptTemplateId: '', status: 'pending', retries: 0, createdAt: now, priority: 'normal' })
      await AiJobRepository.save({ id: 'j4', documentId: 'd4', modelId: 'm1', promptTemplateId: '', status: 'success', retries: 0, createdAt: now })

      const pending = await AiJobRepository.findPending()
      expect(pending).toHaveLength(3)
      expect(pending[0].id).toBe('j2') // high
      expect(pending[1].id).toBe('j3') // normal
      expect(pending[2].id).toBe('j1') // low
    })

    it('respects sortOrder within the same priority', async () => {
      const now = '2026-01-01T00:00:00Z'
      await AiJobRepository.save({ id: 'j1', documentId: 'd1', modelId: 'm1', promptTemplateId: '', status: 'pending', retries: 0, createdAt: now, priority: 'normal', sortOrder: 2 })
      await AiJobRepository.save({ id: 'j2', documentId: 'd2', modelId: 'm1', promptTemplateId: '', status: 'pending', retries: 0, createdAt: now, priority: 'normal', sortOrder: 0 })
      await AiJobRepository.save({ id: 'j3', documentId: 'd3', modelId: 'm1', promptTemplateId: '', status: 'pending', retries: 0, createdAt: now, priority: 'normal', sortOrder: 1 })

      const pending = await AiJobRepository.findPending()
      expect(pending.map((j) => j.id)).toEqual(['j2', 'j3', 'j1'])
    })
  })

  describe('batchUpdate', () => {
    it('updates multiple jobs in a single transaction', async () => {
      await AiJobRepository.save({ id: 'j1', documentId: 'd1', modelId: 'm1', promptTemplateId: '', status: 'pending', retries: 0, createdAt: '2026-01-01T00:00:00Z' })
      await AiJobRepository.save({ id: 'j2', documentId: 'd2', modelId: 'm1', promptTemplateId: '', status: 'pending', retries: 0, createdAt: '2026-01-01T00:00:00Z' })

      await AiJobRepository.batchUpdate(['j1', 'j2'], { priority: 'high' })

      const j1 = await AiJobRepository.findById('j1')
      const j2 = await AiJobRepository.findById('j2')
      expect(j1?.priority).toBe('high')
      expect(j2?.priority).toBe('high')
    })
  })

  describe('reorderPendingJobs', () => {
    it('assigns sequential sortOrder to the given IDs', async () => {
      await AiJobRepository.save({ id: 'j1', documentId: 'd1', modelId: 'm1', promptTemplateId: '', status: 'pending', retries: 0, createdAt: '2026-01-01T00:00:00Z' })
      await AiJobRepository.save({ id: 'j2', documentId: 'd2', modelId: 'm1', promptTemplateId: '', status: 'pending', retries: 0, createdAt: '2026-01-01T00:00:00Z' })
      await AiJobRepository.save({ id: 'j3', documentId: 'd3', modelId: 'm1', promptTemplateId: '', status: 'pending', retries: 0, createdAt: '2026-01-01T00:00:00Z' })

      await AiJobRepository.reorderPendingJobs(['j3', 'j1', 'j2'])

      const j3 = await AiJobRepository.findById('j3')
      const j1 = await AiJobRepository.findById('j1')
      const j2 = await AiJobRepository.findById('j2')
      expect(j3?.sortOrder).toBe(0)
      expect(j1?.sortOrder).toBe(1)
      expect(j2?.sortOrder).toBe(2)
    })
  })

  describe('deleteMany', () => {
    it('deletes multiple jobs by ID', async () => {
      await AiJobRepository.save({ id: 'j1', documentId: 'd1', modelId: 'm1', promptTemplateId: '', status: 'pending', retries: 0, createdAt: '2026-01-01T00:00:00Z' })
      await AiJobRepository.save({ id: 'j2', documentId: 'd2', modelId: 'm1', promptTemplateId: '', status: 'pending', retries: 0, createdAt: '2026-01-01T00:00:00Z' })
      await AiJobRepository.save({ id: 'j3', documentId: 'd3', modelId: 'm1', promptTemplateId: '', status: 'pending', retries: 0, createdAt: '2026-01-01T00:00:00Z' })

      await AiJobRepository.deleteMany(['j1', 'j3'])

      const all = await AiJobRepository.findAll()
      expect(all).toHaveLength(1)
      expect(all[0].id).toBe('j2')
    })
  })
})
