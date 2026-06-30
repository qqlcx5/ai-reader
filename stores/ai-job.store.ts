import { defineStore } from 'pinia'
import { ref } from 'vue'
import { AiJobRepository } from '../db/repositories/ai-job.repository'
import { drainAll } from '../services/ai-job/processor'
import type { AiJobEntity } from '../types/ai-job'

export const useAiJobStore = defineStore('ai-job', () => {
  const jobs = ref<AiJobEntity[]>([])
  const draining = ref(false)

  async function loadJobs() {
    jobs.value = await AiJobRepository.findAll()
  }

  /** Reset a failed job to pending and kick off a drain. */
  async function retry(jobId: string) {
    const job = jobs.value.find((j) => j.id === jobId) ?? (await AiJobRepository.findById(jobId))
    if (!job || job.status !== 'failed') return
    await AiJobRepository.save({
      ...job,
      status: 'pending',
      error: undefined,
      retries: job.retries + 1,
    })
    await loadJobs()
    void drain()
  }

  async function remove(jobId: string) {
    await AiJobRepository.delete(jobId)
    await loadJobs()
  }

  async function clearDone() {
    await AiJobRepository.deleteByStatus('success')
    await AiJobRepository.deleteByStatus('failed')
    await loadJobs()
  }

  /** Drain pending jobs (panel-side). Safe to call repeatedly — re-entrant guard. */
  async function drain() {
    if (draining.value) return
    draining.value = true
    try {
      await drainAll()
      await loadJobs()
    } finally {
      draining.value = false
    }
  }

  return { jobs, draining, loadJobs, retry, remove, clearDone, drain }
})
