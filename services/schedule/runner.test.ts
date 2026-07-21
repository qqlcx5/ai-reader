import { describe, it, expect, beforeEach, vi } from 'vitest'
import { db } from '@/db'

// enqueueBatch is the only side-effecting dep; mock it to capture calls.
const enqueueBatchMock = vi.fn(async (_opts: any) => ({ enqueued: 0, skipped: 0, batchId: 'b' }))
vi.mock('@/services/ai-job/queue', () => ({
  enqueueBatch: (opts: any) => enqueueBatchMock(opts),
}))

import { tryFireSchedule, runSchedules } from './runner'
import { ScheduleRepository } from '@/db/repositories/schedule.repository'
import { DocumentRepository } from '@/db/repositories/document.repository'

async function resetDB() {
  await Promise.all(
    [db.documents, db.models, db.settings, db.schedules, db.aiJobs, db.conversations].map((t) => t.clear()),
  )
}

describe('schedule runner', () => {
  beforeEach(async () => {
    enqueueBatchMock.mockReset()
    enqueueBatchMock.mockResolvedValue({ enqueued: 0, skipped: 0, batchId: 'b' })
    await resetDB()
  })

  it('does not fire when disabled', async () => {
    await ScheduleRepository.save({
      id: 's1', enabled: false, label: 'off', cron: '* * * * *',
      scope: 'all', modelId: 'm1', promptTemplateId: 't1', priority: 'normal',
      createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
    })
    const r = await tryFireSchedule(
      (await ScheduleRepository.findById('s1'))!,
      new Date('2026-07-21T09:00:00'),
    )
    expect(r.fired).toBe(false)
    expect(enqueueBatchMock).not.toHaveBeenCalled()
  })

  it('fires and enqueues all docs when cron matches', async () => {
    await DocumentRepository.save({
      id: 'd1', url: 'https://x.test/1', title: 'A', markdown: 'x',
      wordCount: 1, tokenCount: 1, contentHash: 'h1', extractionMethod: 'manual',
      source: 'library', capturedAt: '2026-07-01T00:00:00Z', updatedAt: '2026-07-01T00:00:00Z',
    } as any)
    await DocumentRepository.save({
      id: 'd2', url: 'https://x.test/2', title: 'B', markdown: 'x',
      wordCount: 1, tokenCount: 1, contentHash: 'h2', extractionMethod: 'manual',
      source: 'library', capturedAt: '2026-07-01T00:00:00Z', updatedAt: '2026-07-01T00:00:00Z',
    } as any)
    await ScheduleRepository.save({
      id: 's1', enabled: true, label: 'on', cron: '0 9 * * *',
      scope: 'all', modelId: 'm1', promptTemplateId: 't1', priority: 'normal',
      createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
    })

    const r = await tryFireSchedule(
      (await ScheduleRepository.findById('s1'))!,
      new Date('2026-07-21T09:00:00'),
    )
    expect(r.fired).toBe(true)
    expect(enqueueBatchMock).toHaveBeenCalledTimes(1)
    const opts = enqueueBatchMock.mock.calls[0][0]
    expect(opts.documentIds).toEqual(expect.arrayContaining(['d1', 'd2']))
    expect(opts.priority).toBe('normal')

    // lastFiredAt persisted
    const after = await ScheduleRepository.findById('s1')
    expect(after?.lastFiredAt).toBeTruthy()
  })

  it('does not fire when cron does not match', async () => {
    await ScheduleRepository.save({
      id: 's1', enabled: true, label: 'on', cron: '0 23 * * *',
      scope: 'all', modelId: 'm1', promptTemplateId: 't1', priority: 'normal',
      createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
    })
    const r = await tryFireSchedule(
      (await ScheduleRepository.findById('s1'))!,
      new Date('2026-07-21T09:00:00'),
    )
    expect(r.fired).toBe(false)
    expect(enqueueBatchMock).not.toHaveBeenCalled()
  })

  it('does not double-fire within the same minute', async () => {
    await ScheduleRepository.save({
      id: 's1', enabled: true, label: 'on', cron: '* * * * *',
      scope: 'all', modelId: 'm1', promptTemplateId: 't1', priority: 'normal',
      createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
      lastFiredAt: '2026-07-21T09:00:30', // 30s ago
    })
    const r = await tryFireSchedule(
      (await ScheduleRepository.findById('s1'))!,
      new Date('2026-07-21T09:00:45'),
    )
    expect(r.fired).toBe(false)
  })

  it('marks the schedule with an error when cron is malformed', async () => {
    await ScheduleRepository.save({
      id: 's1', enabled: true, label: 'on', cron: 'bad',
      scope: 'all', modelId: 'm1', promptTemplateId: 't1', priority: 'normal',
      createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
    })
    const r = await tryFireSchedule(
      (await ScheduleRepository.findById('s1'))!,
      new Date('2026-07-21T09:00:00'),
    )
    expect(r.error).toBeTruthy()
    const after = await ScheduleRepository.findById('s1')
    expect(after?.lastFireError).toBeTruthy()
  })

  it('runSchedules fires all enabled schedules that match', async () => {
    await ScheduleRepository.save({
      id: 's1', enabled: true, label: 'match', cron: '0 9 * * *',
      scope: 'all', modelId: 'm1', promptTemplateId: 't1', priority: 'normal',
      createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
    })
    await ScheduleRepository.save({
      id: 's2', enabled: true, label: 'no-match', cron: '0 23 * * *',
      scope: 'all', modelId: 'm1', promptTemplateId: 't1', priority: 'normal',
      createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
    })
    await ScheduleRepository.save({
      id: 's3', enabled: false, label: 'off', cron: '* * * * *',
      scope: 'all', modelId: 'm1', promptTemplateId: 't1', priority: 'normal',
      createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
    })

    const results = await runSchedules(new Date('2026-07-21T09:00:00'))
    const fired = results.filter((r) => r.fired)
    expect(fired.length).toBe(1)
    expect(fired[0].scheduleId).toBe('s1')
  })

  it('uses the default model when schedule model is empty', async () => {
    await db.models.put({
      id: 'm-default', name: 'Default', provider: 'ollama', modelId: 'llama3',
      enabled: true, isDefault: true,
      createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
    })
    await ScheduleRepository.save({
      id: 's1', enabled: true, label: 'default model', cron: '0 9 * * *',
      scope: 'all', modelId: '', promptTemplateId: '', priority: 'normal',
      createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
    })
    const r = await tryFireSchedule(
      (await ScheduleRepository.findById('s1'))!,
      new Date('2026-07-21T09:00:00'),
    )
    expect(r.fired).toBe(true)
    expect(r.error).toBeUndefined()
    expect(enqueueBatchMock).toHaveBeenCalledWith(expect.objectContaining({ modelId: 'm-default' }))
  })
})
