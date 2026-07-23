import { onUnmounted, watch } from 'vue'

type AiJobStoreLike = {
  stats: { pending: number; processing: number }
  queuePaused: boolean
  loadJobs: () => Promise<void>
}

/** Poll loadJobs while there are active (pending/processing) jobs and queue is not paused. */
export function useAnalysisPolling(store: AiJobStoreLike) {
  let pollTimer: ReturnType<typeof setInterval> | null = null

  function startPolling() {
    if (pollTimer) return
    pollTimer = setInterval(() => {
      void store.loadJobs()
    }, 2000)
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
  }

  watch(
    () => store.stats.pending + store.stats.processing,
    (active) => {
      if (active > 0 && !store.queuePaused) startPolling()
      else stopPolling()
    },
  )

  onUnmounted(() => {
    stopPolling()
  })

  return { startPolling, stopPolling }
}
