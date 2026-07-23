import dayjs from 'dayjs'
import { AiJobRepository } from '@/db/repositories/ai-job.repository'
import { SettingsRepository } from '@/db/repositories/settings.repository'
import { activeControllers, processJob } from '@/services/ai-job/process-job'

/** User-initiated cancel. Marks the job so the next retry check bails out,
 *  aborts any in-flight provider request, and sets status to 'cancelled'.
 *  No-op if the job isn't currently processing. */
export async function cancelJob(jobId: string): Promise<void> {
  await AiJobRepository.savePatch(jobId, { cancelRequested: true })
  activeControllers.get(jobId)?.abort()
  // The processor writes the final 'cancelled' status when it observes the
  // abort; this is a fallback for the race where cancel arrives between
  // setStatus('processing') and controller registration.
  await AiJobRepository.setStatus(jobId, 'cancelled', {
    finishedAt: dayjs().toISOString(),
    error: undefined,
  })
}

/** Drain all pending jobs sequentially (panel-driven). Best-effort: a failure
 *  marks the job failed and the loop continues.
 *  Respects the queue-paused flag: if paused, returns immediately without
 *  processing — in-flight jobs finish naturally. */
export async function drainAll(): Promise<{ processed: number; succeeded: number; failed: number; cancelled: number }> {
  const settings = await SettingsRepository.get()

  // Respect queue-pause: don't pick up new jobs when paused
  if (settings?.autoAnalysis?.queuePaused) {
    return { processed: 0, succeeded: 0, failed: 0, cancelled: 0 }
  }

  const pending = await AiJobRepository.findPending()
  let succeeded = 0
  let failed = 0
  let cancelled = 0
  for (const job of pending) {
    // Re-read pause state because the user may pause while a job is running.
    const currentSettings = await SettingsRepository.get()
    if (currentSettings?.autoAnalysis?.queuePaused) break
    // Re-read in case cancel / priority changed since findPending()
    const fresh = await AiJobRepository.findById(job.id)
    if (!fresh || fresh.status !== 'pending') continue
    const r = await processJob(fresh, settings)
    if (r === 'success') succeeded++
    else if (r === 'cancelled') cancelled++
    else failed++
  }
  return { processed: succeeded + failed + cancelled, succeeded, failed, cancelled }
}

/** On startup: reclaim jobs stuck in 'processing' after a crash / SW restart. */
export async function reclaimStaleJobs(): Promise<number> {
  const stuck = await AiJobRepository.findByStatus('processing')
  for (const job of stuck) {
    await AiJobRepository.setStatus(job.id, 'failed', {
      error: '处理中断（扩展重启）',
      finishedAt: dayjs().toISOString(),
    })
  }
  return stuck.length
}
