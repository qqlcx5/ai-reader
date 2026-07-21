import dayjs from 'dayjs'
import { ScheduleRepository } from '@/db/repositories/schedule.repository'
import { DocumentRepository } from '@/db/repositories/document.repository'
import { CollectionRepository } from '@/db/repositories/collection.repository'
import { ModelRepository } from '@/db/repositories/model.repository'
import { enqueueBatch } from '@/services/ai-job/queue'
import { cronExprMatchesNow } from '@/services/schedule/cron'
import type { ScheduleEntity, ScheduleScope } from '@/types/schedule'

/**
 * Resolve the set of document ids a schedule should process based on its scope.
 *
 * - today:   documents captured in the last 24h
 * - unread:  documents with readProgress < 1 (or null)
 * - all:     every document
 * - collection: documents in a specific collection
 */
async function resolveDocumentIds(scope: ScheduleScope, collectionId?: string): Promise<string[]> {
  switch (scope) {
    case 'today': {
      const since = dayjs().subtract(24, 'hour').toISOString()
      const docs = await DocumentRepository.findAll()
      return docs.filter((d) => d.capturedAt && d.capturedAt >= since).map((d) => d.id)
    }
    case 'unread': {
      const docs = await DocumentRepository.findAll()
      return docs.filter((d) => (d.readProgress ?? 0) < 1).map((d) => d.id)
    }
    case 'collection': {
      if (!collectionId) return []
      return CollectionRepository.getDocumentIds(collectionId)
    }
    case 'all':
    default: {
      const docs = await DocumentRepository.findAll()
      return docs.map((d) => d.id)
    }
  }
}

export interface FireResult {
  scheduleId: string
  fired: boolean
  enqueued: number
  skipped: number
  error?: string
}

/** Check one schedule against the current minute; enqueue if it matches.
 *  Returns fired=false when the cron doesn't match now or the schedule is off. */
export async function tryFireSchedule(schedule: ScheduleEntity, now: Date = new Date()): Promise<FireResult> {
  const base: FireResult = { scheduleId: schedule.id, fired: false, enqueued: 0, skipped: 0 }
  if (!schedule.enabled) return base

  // Avoid double-firing in the same minute (alarm may tick while SW is alive
  // across minute boundary, or panel triggers a manual re-run).
  if (schedule.lastFiredAt) {
    const last = dayjs(schedule.lastFiredAt)
    if (last.isAfter(dayjs(now).subtract(1, 'minute'))) return base
  }

  let matches: boolean
  try {
    matches = cronExprMatchesNow(schedule.cron, now)
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e)
    await ScheduleRepository.markFired(schedule.id, now.toISOString(), `Cron 解析失败: ${err}`)
    return { ...base, error: err }
  }
  if (!matches) return base

  try {
    const docIds = await resolveDocumentIds(schedule.scope, schedule.collectionId)
    const modelId = schedule.modelId || (await ModelRepository.findDefault())?.id
    if (!modelId) {
      const error = '未配置可用模型'
      await ScheduleRepository.markFired(schedule.id, now.toISOString(), error)
      return { ...base, fired: true, error }
    }

    const result = await enqueueBatch({
      documentIds: docIds,
      modelId,
      promptTemplateId: schedule.promptTemplateId,
      batchId: `sched_${schedule.id}_${now.getTime()}`,
      priority: schedule.priority,
    })
    await ScheduleRepository.markFired(schedule.id, now.toISOString())
    return { ...base, fired: true, enqueued: result.enqueued, skipped: result.skipped }
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e)
    await ScheduleRepository.markFired(schedule.id, now.toISOString(), err)
    return { ...base, fired: true, error: err }
  }
}

/** Check all enabled schedules against the current minute. Called by the
 *  background alarm roughly once per minute. */
export async function runSchedules(now: Date = new Date()): Promise<FireResult[]> {
  const schedules = await ScheduleRepository.findEnabled()
  return Promise.all(schedules.map((s) => tryFireSchedule(s, now)))
}
