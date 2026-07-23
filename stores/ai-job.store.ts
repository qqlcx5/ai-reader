import dayjs from 'dayjs'
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { AiJobRepository } from '../db/repositories/ai-job.repository'
import { SettingsRepository } from '../db/repositories/settings.repository'
import { drainAll, cancelJob } from '../services/ai-job/processor'
import { enqueueBatch, type BatchEnqueueOptions } from '../services/ai-job/queue'
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
} from '../services/ai-job/job-control'
import type { AiJobEntity, AiJobStats, AiJobStatus, AiJobPriority } from '../types/ai-job'
import { PRIORITY_WEIGHT } from '../types/ai-job'

export const useAiJobStore = defineStore('ai-job', () => {
  const jobs = ref<AiJobEntity[]>([])
  const draining = ref(false)
  const queuePaused = ref(false)
  const stats = ref<AiJobStats>({
    total: 0, pending: 0, processing: 0, success: 0, failed: 0, cancelled: 0,
    successRate: 0, avgDurationMs: 0,
  })

  /** Pending jobs sorted by priority → sortOrder → createdAt (for drag-and-drop list). */
  const sortedPendingJobs = computed(() =>
    jobs.value
      .filter((j) => j.status === 'pending')
      .sort((a, b) => {
        const pa = PRIORITY_WEIGHT[a.priority ?? 'normal']
        const pb = PRIORITY_WEIGHT[b.priority ?? 'normal']
        if (pb !== pa) return pb - pa
        const sa = a.sortOrder ?? Number.MAX_SAFE_INTEGER
        const sb = b.sortOrder ?? Number.MAX_SAFE_INTEGER
        if (sa !== sb) return sa - sb
        return dayjs(a.createdAt).valueOf() - dayjs(b.createdAt).valueOf()
      }),
  )

  // Group by batchId for batch view
  const batches = computed(() => {
    const map = new Map<string, { batchId: string; jobs: AiJobEntity[]; createdAt: string }>()
    for (const job of jobs.value) {
      if (!job.batchId) continue
      let entry = map.get(job.batchId)
      if (!entry) {
        entry = { batchId: job.batchId, jobs: [], createdAt: job.createdAt }
        map.set(job.batchId, entry)
      }
      entry.jobs.push(job)
      if (job.createdAt < entry.createdAt) entry.createdAt = job.createdAt
    }
    return [...map.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  })

  async function loadJobs() {
    jobs.value = await AiJobRepository.findAll()
    await refreshStats()
    await refreshPauseState()
  }

  async function refreshStats() {
    stats.value = await AiJobRepository.getStats()
  }

  async function refreshPauseState() {
    const s = await SettingsRepository.get()
    queuePaused.value = s?.autoAnalysis?.queuePaused ?? false
  }

  /** Toggle the global queue pause. When paused, drain won't pick up new jobs. */
  async function toggleQueuePause() {
    const s = await SettingsRepository.get()
    if (!s) return
    const newPaused = !queuePaused.value
    await SettingsRepository.save({
      ...s,
      autoAnalysis: { ...s.autoAnalysis, queuePaused: newPaused },
    })
    queuePaused.value = newPaused
  }

  /** Reset a failed/cancelled job to pending and kick off a drain. */
  async function retry(jobId: string) {
    const job = jobs.value.find((j) => j.id === jobId) ?? (await AiJobRepository.findById(jobId))
    if (!job || !(await retryJob(job))) return
    await loadJobs()
    void drain()
  }

  /** Cancel an in-flight (processing) or queued (pending) job.
   *  Processing jobs abort their live provider request; pending jobs just flip status. */
  async function cancel(jobId: string) {
    const job = jobs.value.find((j) => j.id === jobId) ?? (await AiJobRepository.findById(jobId))
    if (!job) return
    if (job.status === 'processing') {
      await cancelJob(jobId)
    } else if (job.status === 'pending') {
      await cancelPendingJob(jobId)
    }
    await loadJobs()
  }

  /** Retry all failed or cancelled jobs in one go. */
  async function retryAllFailed() {
    const retryableJobs = jobs.value.filter((j) => j.status === 'failed' || j.status === 'cancelled')
    if (!retryableJobs.length) return
    await retryJobs(retryableJobs)
    await loadJobs()
    void drain()
  }

  /** Retry the supplied failed or cancelled jobs. */
  async function retryMany(ids: string[]) {
    const selected = jobs.value.filter((j) => ids.includes(j.id))
    if (!selected.length) return
    await retryJobs(selected)
    await loadJobs()
    void drain()
  }

  async function remove(jobId: string) {
    await removeJob(jobId)
    await loadJobs()
  }

  /** Delete the supplied jobs. */
  async function removeMany(ids: string[]) {
    await removeJobs(ids)
    await loadJobs()
  }

  async function clearDone() {
    await clearCompletedJobs()
    await loadJobs()
  }

  /** Remove all jobs matching a given status. */
  async function clearByStatus(status: AiJobStatus) {
    await clearJobsByStatus(status)
    await loadJobs()
  }

  /** Set priority for a single job. */
  async function setPriority(jobId: string, priority: AiJobPriority) {
    await setJobPriority(jobId, priority)
    await loadJobs()
  }

  /** Set priority for the supplied jobs. */
  async function setPriorityMany(ids: string[], priority: AiJobPriority) {
    await setJobsPriority(ids, priority)
    await loadJobs()
  }

  /** Reorder pending jobs (drag-and-drop). Pass the full ordered list of pending job IDs. */
  async function reorderPendingJobs(orderedIds: string[]) {
    await reorderJobs(orderedIds)
    await loadJobs()
  }

  /** Enqueue batch analysis jobs for multiple documents (manual trigger).
   *  Bypasses dedupe — allows re-analyzing with a different template/model. */
  async function enqueueBatchJobs(opts: BatchEnqueueOptions) {
    const result = await enqueueBatch(opts)
    await loadJobs()
    // Auto-start draining so the user sees progress immediately (unless paused).
    if (!queuePaused.value) void drain()
    return result
  }

  /** Drain pending jobs (panel-side). Safe to call repeatedly — re-entrant guard. */
  async function drain() {
    if (draining.value) return
    if (queuePaused.value) return
    draining.value = true
    try {
      await drainAll()
      await loadJobs()
    } finally {
      draining.value = false
      // Notify other stores that AI jobs may have changed
      ;(globalThis as any).__aiJobsChanged?.()
    }
  }

  return {
    jobs,
    sortedPendingJobs,
    batches,
    draining,
    queuePaused,
    stats,
    loadJobs,
    refreshStats,
    refreshPauseState,
    toggleQueuePause,
    retry,
    cancel,
    retryAllFailed,
    retryMany,
    remove,
    removeMany,
    clearDone,
    clearByStatus,
    setPriority,
    setPriorityMany,
    reorderPendingJobs,
    enqueueBatchJobs,
    drain,
  }
})
