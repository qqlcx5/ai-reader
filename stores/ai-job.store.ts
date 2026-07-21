import dayjs from 'dayjs'
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { AiJobRepository } from '../db/repositories/ai-job.repository'
import { SettingsRepository } from '../db/repositories/settings.repository'
import { drainAll, cancelJob, reclaimStaleJobs } from '../services/ai-job/processor'
import { enqueueBatch, type BatchEnqueueOptions } from '../services/ai-job/queue'
import type { AiJobEntity, AiJobStats, AiJobFilter, AiJobStatus, AiJobPriority } from '../types/ai-job'
import { PRIORITY_WEIGHT } from '../types/ai-job'

export const useAiJobStore = defineStore('ai-job', () => {
  const jobs = ref<AiJobEntity[]>([])
  const draining = ref(false)
  const queuePaused = ref(false)
  const stats = ref<AiJobStats>({
    total: 0, pending: 0, processing: 0, success: 0, failed: 0, cancelled: 0,
    successRate: 0, avgDurationMs: 0,
  })

  // Filter state for the analysis panel
  const filter = ref<AiJobFilter>({ status: 'all' })

  // ── Multi-select state ──
  const selectedIds = ref<Set<string>>(new Set())
  const selectMode = ref(false)

  const filteredJobs = computed(() => {
    let result = jobs.value

    if (filter.value.status && filter.value.status !== 'all') {
      result = result.filter((j) => j.status === filter.value.status)
    }
    if (filter.value.modelId) {
      result = result.filter((j) => j.modelId === filter.value.modelId)
    }
    if (filter.value.batchId) {
      result = result.filter((j) => j.batchId === filter.value.batchId)
    }
    if (filter.value.search) {
      const q = filter.value.search.toLowerCase()
      result = result.filter(
        (j) =>
          j.documentTitle?.toLowerCase().includes(q) ||
          j.error?.toLowerCase().includes(q),
      )
    }

    return result
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

  // ── Selection helpers ──
  function toggleSelect(jobId: string) {
    const s = new Set(selectedIds.value)
    if (s.has(jobId)) s.delete(jobId)
    else s.add(jobId)
    selectedIds.value = s
  }

  function selectAll() {
    selectedIds.value = new Set(filteredJobs.value.map((j) => j.id))
  }

  function selectNone() {
    selectedIds.value = new Set()
  }

  function toggleSelectMode() {
    selectMode.value = !selectMode.value
    if (!selectMode.value) selectNone()
  }

  const selectedJobs = computed(() =>
    jobs.value.filter((j) => selectedIds.value.has(j.id)),
  )

  const selectedCount = computed(() => selectedIds.value.size)

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
    if (!job || (job.status !== 'failed' && job.status !== 'cancelled')) return
    await AiJobRepository.save({
      ...job,
      status: 'pending',
      error: undefined,
      cancelRequested: false,
      retries: job.retries + 1,
    })
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
      await AiJobRepository.setStatus(jobId, 'cancelled', {
        finishedAt: dayjs().toISOString(),
        error: undefined,
      })
    }
    await loadJobs()
  }

  /** Retry all failed jobs in one go. */
  async function retryAllFailed() {
    const failedJobs = jobs.value.filter((j) => j.status === 'failed')
    if (!failedJobs.length) return

    for (const job of failedJobs) {
      await AiJobRepository.save({
        ...job,
        status: 'pending',
        error: undefined,
        retries: job.retries + 1,
      })
    }
    await loadJobs()
    void drain()
  }

  /** Retry selected failed jobs. */
  async function retrySelected() {
    const toRetry = selectedJobs.value.filter((j) => j.status === 'failed')
    if (!toRetry.length) return
    for (const job of toRetry) {
      await AiJobRepository.save({
        ...job,
        status: 'pending',
        error: undefined,
        retries: job.retries + 1,
      })
    }
    selectNone()
    await loadJobs()
    void drain()
  }

  async function remove(jobId: string) {
    await AiJobRepository.delete(jobId)
    await loadJobs()
  }

  /** Delete all selected jobs. */
  async function removeSelected() {
    const ids = [...selectedIds.value]
    if (!ids.length) return
    await AiJobRepository.deleteMany(ids)
    selectNone()
    await loadJobs()
  }

  async function clearDone() {
    await AiJobRepository.deleteByStatus('success')
    await AiJobRepository.deleteByStatus('failed')
    await loadJobs()
  }

  /** Remove all jobs matching a given status. */
  async function clearByStatus(status: AiJobStatus) {
    await AiJobRepository.deleteByStatus(status)
    await loadJobs()
  }

  /** Set priority for a single job. */
  async function setPriority(jobId: string, priority: AiJobPriority) {
    await AiJobRepository.batchUpdate([jobId], { priority })
    await loadJobs()
  }

  /** Set priority for all selected jobs. */
  async function setPrioritySelected(priority: AiJobPriority) {
    const ids = [...selectedIds.value]
    if (!ids.length) return
    await AiJobRepository.batchUpdate(ids, { priority })
    selectNone()
    await loadJobs()
  }

  /** Reorder pending jobs (drag-and-drop). Pass the full ordered list of pending job IDs. */
  async function reorderPendingJobs(orderedIds: string[]) {
    await AiJobRepository.reorderPendingJobs(orderedIds)
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

  function setFilter(patch: Partial<AiJobFilter>) {
    filter.value = { ...filter.value, ...patch }
  }

  function resetFilter() {
    filter.value = { status: 'all' }
  }

  return {
    jobs,
    filteredJobs,
    sortedPendingJobs,
    batches,
    draining,
    queuePaused,
    stats,
    filter,
    // multi-select
    selectedIds,
    selectMode,
    selectedJobs,
    selectedCount,
    toggleSelect,
    selectAll,
    selectNone,
    toggleSelectMode,
    removeSelected,
    retrySelected,
    setPrioritySelected,
    // actions
    loadJobs,
    refreshStats,
    refreshPauseState,
    toggleQueuePause,
    retry,
    cancel,
    retryAllFailed,
    remove,
    clearDone,
    clearByStatus,
    setPriority,
    reorderPendingJobs,
    enqueueBatchJobs,
    drain,
    setFilter,
    resetFilter,
  }
})
