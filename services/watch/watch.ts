/**
 * Page-change watching: fetch a URL, extract its content, and compare the
 * content hash against the last seen version. Changes are recorded on the
 * watch with a previous-version excerpt for a simple diff view.
 *
 * Extraction is injected so tests stay pure; the background wires the
 * offscreen/local-DOMParser extractor (sendToOffscreen).
 */
import dayjs from 'dayjs'
import type { PageWatchEntity, PageWatchChange } from '@/types/page-watch'

/** Max change records kept per watch. */
export const MAX_CHANGES = 20

/** Excerpt length (chars) of the previous version stored per change. */
const EXCERPT_CHARS = 2000

export interface ExtractionResult {
  contentHash: string
  markdown: string
  title?: string
}

export type ExtractFn = (url: string) => Promise<ExtractionResult | null>

export interface CheckResult {
  changed: boolean
  watch: PageWatchEntity
  error?: string
}

/** Check one watch against a fresh extraction. Pure aside from extract(). */
export async function checkWatch(
  watch: PageWatchEntity,
  extract: ExtractFn,
  now: Date = new Date(),
): Promise<CheckResult> {
  try {
    const result = await extract(watch.url)
    if (!result) return { changed: false, watch, error: 'extract-failed' }

    const nowIso = now.toISOString()
    const changed = watch.lastHash != null && watch.lastHash !== result.contentHash

    let changes: PageWatchChange[] | undefined
    if (changed) {
      const entry: PageWatchChange = { at: nowIso, hash: result.contentHash, previousExcerpt: (watch.lastMarkdownExcerpt ?? '').slice(0, EXCERPT_CHARS) }
      changes = [entry, ...(watch.changes ?? [])].slice(0, MAX_CHANGES)
    }

    const updated: PageWatchEntity = {
      ...watch,
      title: watch.title || result.title || watch.url,
      lastHash: result.contentHash,
      lastMarkdownExcerpt: result.markdown.slice(0, EXCERPT_CHARS),
      lastCheckedAt: nowIso,
      lastChangedAt: changed ? nowIso : watch.lastChangedAt,
      changes,
      updatedAt: nowIso,
    }
    return { changed, watch: updated }
  } catch (e: any) {
    return {
      changed: false,
      watch: { ...watch, lastCheckedAt: now.toISOString(), lastError: e?.message, updatedAt: now.toISOString() },
      error: e?.message || 'fetch-failed',
    }
  }
}

// ── Persistence (thin wrappers, for the background loop) ─────────────────

import { db } from '@/db/index'

export const PageWatchRepository = {
  async findAll(): Promise<PageWatchEntity[]> {
    return db.pageWatches.toArray()
  },
  async findEnabled(): Promise<PageWatchEntity[]> {
    return db.pageWatches.filter((w) => w.enabled).toArray()
  },
  async save(watch: PageWatchEntity): Promise<void> {
    await db.pageWatches.put(watch)
  },
  async delete(id: string): Promise<void> {
    await db.pageWatches.delete(id)
  },
}

/** Extract via the offscreen document (Chromium) or local DOMParser (Firefox). */
async function extractViaBackground(url: string): Promise<ExtractionResult | null> {
  const { sendToOffscreen } = await import('@/services/offscreen/manager')
  const res = await fetch(url, { redirect: 'follow' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const html = await res.text()
  const data = await sendToOffscreen<any>({ type: 'EXTRACT_HTML', html, url, meta: {} })
  if (!data?.ok) return null
  return {
    contentHash: data.data.contentHash,
    markdown: data.data.markdown,
    title: data.data.title,
  }
}

/** Check every enabled watch; persist results; return the changed watches. */
export async function checkAllWatches(): Promise<PageWatchEntity[]> {
  const watches = await PageWatchRepository.findEnabled()
  const changed: PageWatchEntity[] = []
  for (const watch of watches) {
    const result = await checkWatch(watch, extractViaBackground)
    await PageWatchRepository.save(result.watch)
    if (result.changed) changed.push(result.watch)
  }
  return changed
}
