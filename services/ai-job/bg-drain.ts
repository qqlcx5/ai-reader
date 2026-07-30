import { AiJobRepository } from '@/db/repositories/ai-job.repository'
import { SettingsRepository } from '@/db/repositories/settings.repository'
import { processJob } from '@/services/ai-job/process-job'
import type { AppSettings } from '@/types/settings'

/** Max jobs to process per background drain tick. Keep small to avoid
 *  monopolising the service worker — the panel does full drain when open. */
const BG_DRAIN_LIMIT = 2

/** Minimum interval between background drains (ms). Prevents redundant
 *  runs when multiple alarms fire close together. */
const BG_DRAIN_COOLDOWN_MS = 60_000

let lastBgDrainAt = 0
let bgDrainRunning = false

/** Background-side lightweight drain: process up to BG_DRAIN_LIMIT pending
 *  jobs. Called from the background alarm handler so AI analysis progresses
 *  even when the side panel is closed.
 *
 *  Safety:
 *  - Skips when queue is paused.
 *  - Skips when another bg drain is in progress (re-entrancy guard).
 *  - Respects BG_DRAIN_COOLDOWN_MS between runs. */
export async function bgDrain(): Promise<void> {
  if (bgDrainRunning) return
  const now = Date.now()
  if (now - lastBgDrainAt < BG_DRAIN_COOLDOWN_MS) return

  bgDrainRunning = true
  lastBgDrainAt = now

  try {
    const settings = await SettingsRepository.get()
    if (settings?.autoAnalysis?.queuePaused) return

    const pending = await AiJobRepository.findPending()
    const batch = pending.slice(0, BG_DRAIN_LIMIT)

    for (const job of batch) {
      // Re-check pause state between jobs.
      const s = await SettingsRepository.get()
      if (s?.autoAnalysis?.queuePaused) break

      // Re-read in case cancel / status changed since findPending().
      const fresh = await AiJobRepository.findById(job.id)
      if (!fresh || fresh.status !== 'pending') continue

      await processJob(fresh, settings as AppSettings)
    }
  } catch (e) {
    console.warn('[bg] drain failed:', e)
  } finally {
    bgDrainRunning = false
  }
}
