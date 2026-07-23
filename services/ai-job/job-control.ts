import dayjs from 'dayjs'
import { AiJobRepository } from '@/db/repositories/ai-job.repository'
import type { AiJobEntity, AiJobPriority, AiJobStatus } from '@/types/ai-job'

const RETRYABLE_STATUSES: AiJobStatus[] = ['failed', 'cancelled']

function isRetryable(job: AiJobEntity): boolean {
  return RETRYABLE_STATUSES.includes(job.status)
}

/** Reset one failed/cancelled job to pending. Returns false when it is not retryable. */
export async function retryJob(job: AiJobEntity): Promise<boolean> {
  if (!isRetryable(job)) return false
  await AiJobRepository.save({
    ...job,
    status: 'pending',
    error: undefined,
    cancelRequested: false,
    retries: job.retries + 1,
  })
  return true
}

/** Reset all supplied failed/cancelled jobs to pending. */
export async function retryJobs(jobs: AiJobEntity[]): Promise<number> {
  let count = 0
  for (const job of jobs) {
    if (await retryJob(job)) count++
  }
  return count
}

/** Cancel a queued job. In-flight cancellation is handled by processor.cancelJob. */
export async function cancelPendingJob(jobId: string): Promise<boolean> {
  const job = await AiJobRepository.findById(jobId)
  if (!job || job.status !== 'pending') return false
  await AiJobRepository.setStatus(jobId, 'cancelled', {
    finishedAt: dayjs().toISOString(),
    error: undefined,
  })
  return true
}

export async function setJobPriority(jobId: string, priority: AiJobPriority): Promise<void> {
  await AiJobRepository.batchUpdate([jobId], { priority })
}

export async function setJobsPriority(ids: string[], priority: AiJobPriority): Promise<void> {
  if (ids.length) await AiJobRepository.batchUpdate(ids, { priority })
}

export async function reorderJobs(orderedIds: string[]): Promise<void> {
  await AiJobRepository.reorderPendingJobs(orderedIds)
}

export async function removeJob(jobId: string): Promise<void> {
  await AiJobRepository.delete(jobId)
}

export async function removeJobs(ids: string[]): Promise<void> {
  if (ids.length) await AiJobRepository.deleteMany(ids)
}

export async function clearJobsByStatus(status: AiJobStatus): Promise<void> {
  await AiJobRepository.deleteByStatus(status)
}

export async function clearCompletedJobs(): Promise<void> {
  await Promise.all([
    AiJobRepository.deleteByStatus('success'),
    AiJobRepository.deleteByStatus('failed'),
  ])
}
