import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '@/db'
import { AiJobRepository } from '@/db/repositories/ai-job.repository'
import {
  cancelPendingJob,
  clearCompletedJobs,
  clearJobsByStatus,
  removeJob,
  removeJobs,
  reorderJobs,
  retryJob,
  retryJobs,
  setJobPriority,
  setJobsPriority,
} from './job-control'
import type { AiJobEntity } from '@/types/ai-job'

function job(partial: Partial<AiJobEntity> & Pick<AiJobEntity, 'id' | 'status'>): AiJobEntity {
  return {
    documentId: 'doc-1',
    modelId: 'm1',
    promptTemplateId: 'tpl-1',
    retries: 0,
    createdAt: '2026-01-01T00:00:00Z',
    ...partial,
  }
}

describe('job-control', () => {
  beforeEach(async () => {
    await db.aiJobs.clear()
  })

  it('retryJob resets failed/cancelled to pending and bumps retries', async () => {
    const failed = job({ id: 'j1', status: 'failed', error: 'x', cancelRequested: true, retries: 1 })
    await AiJobRepository.save(failed)
    expect(await retryJob(failed)).toBe(true)
    const saved = await AiJobRepository.findById('j1')
    expect(saved?.status).toBe('pending')
    expect(saved?.error).toBeUndefined()
    expect(saved?.cancelRequested).toBe(false)
    expect(saved?.retries).toBe(2)
  })

  it('retryJob ignores non-retryable statuses', async () => {
    const pending = job({ id: 'j2', status: 'pending' })
    await AiJobRepository.save(pending)
    expect(await retryJob(pending)).toBe(false)
    expect((await AiJobRepository.findById('j2'))?.status).toBe('pending')
  })

  it('retryJobs only retries eligible jobs', async () => {
    const a = job({ id: 'a', status: 'failed' })
    const b = job({ id: 'b', status: 'success' })
    await AiJobRepository.save(a)
    await AiJobRepository.save(b)
    expect(await retryJobs([a, b])).toBe(1)
    expect((await AiJobRepository.findById('a'))?.status).toBe('pending')
    expect((await AiJobRepository.findById('b'))?.status).toBe('success')
  })

  it('cancelPendingJob only cancels pending jobs', async () => {
    await AiJobRepository.save(job({ id: 'p', status: 'pending' }))
    await AiJobRepository.save(job({ id: 's', status: 'success' }))
    expect(await cancelPendingJob('p')).toBe(true)
    expect(await cancelPendingJob('s')).toBe(false)
    expect((await AiJobRepository.findById('p'))?.status).toBe('cancelled')
    expect((await AiJobRepository.findById('s'))?.status).toBe('success')
  })

  it('setJobPriority / setJobsPriority update priority', async () => {
    await AiJobRepository.save(job({ id: 'p1', status: 'pending' }))
    await AiJobRepository.save(job({ id: 'p2', status: 'pending' }))
    await setJobPriority('p1', 'high')
    await setJobsPriority(['p1', 'p2'], 'low')
    expect((await AiJobRepository.findById('p1'))?.priority).toBe('low')
    expect((await AiJobRepository.findById('p2'))?.priority).toBe('low')
  })

  it('reorderJobs writes sortOrder in given order', async () => {
    await AiJobRepository.save(job({ id: 'a', status: 'pending' }))
    await AiJobRepository.save(job({ id: 'b', status: 'pending' }))
    await reorderJobs(['b', 'a'])
    expect((await AiJobRepository.findById('b'))?.sortOrder).toBe(0)
    expect((await AiJobRepository.findById('a'))?.sortOrder).toBe(1)
  })

  it('remove / clear helpers delete expected rows', async () => {
    await AiJobRepository.save(job({ id: 'd1', status: 'success' }))
    await AiJobRepository.save(job({ id: 'd2', status: 'failed' }))
    await AiJobRepository.save(job({ id: 'd3', status: 'cancelled' }))
    await removeJob('d3')
    await clearCompletedJobs()
    expect(await AiJobRepository.findAll()).toHaveLength(0)

    await AiJobRepository.save(job({ id: 'x1', status: 'pending' }))
    await AiJobRepository.save(job({ id: 'x2', status: 'pending' }))
    await removeJobs(['x1', 'x2'])
    expect(await AiJobRepository.findAll()).toHaveLength(0)

    await AiJobRepository.save(job({ id: 'c1', status: 'cancelled' }))
    await clearJobsByStatus('cancelled')
    expect(await AiJobRepository.findAll()).toHaveLength(0)
  })
})
