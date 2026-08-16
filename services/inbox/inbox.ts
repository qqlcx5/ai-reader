/**
 * Newsletter inbox — pull-based ingestion.
 *
 * Newsletters are received by an external endpoint the user deploys (see
 * `doc/newsletter-worker/` for a ready-made Cloudflare Email Worker). The
 * extension polls it on the feed-refresh cycle and turns each email into a
 * library document, exactly like RSS auto-collect:
 *
 *   GET {endpoint}?cursor={cursor}
 *   Authorization: Bearer {token}
 *   → { items: InboxItem[], cursor: string }
 */
import dayjs from 'dayjs'
import { extractFromHtml, computeHash, countWords } from '@/utils/content/extract'
import { estimateTokens } from '@/utils/token'
import { DocumentRepository } from '@/db/repositories/document.repository'
import { SettingsRepository } from '@/db/repositories/settings.repository'
import { MetaRepository } from '@/db/repositories/meta.repository'
import { addToIndex } from '@/services/search'
import { enqueueForDocument } from '@/services/ai-job/queue'
import type { DocumentEntity } from '@/types/document'
import type { InboxSettings } from '@/types/settings'

export interface InboxItem {
  id: string
  /** Sender address, e.g. 'weekly@example.com'. */
  from: string
  subject: string
  /** HTML body (preferred). */
  html?: string
  /** Plain-text body (used when the sender sent no HTML part). */
  text?: string
  /** ISO timestamp of receipt. */
  receivedAt: string
  /** Canonical web link to the issue, when the worker extracted one. */
  url?: string
}

export interface InboxResponse {
  items: InboxItem[]
  /** Opaque cursor for the next poll. Absent = start from the oldest. */
  cursor?: string
}

const CURSOR_KEY = 'inbox-cursor'

export async function fetchInboxItems(
  endpoint: string,
  token: string,
  cursor?: string,
): Promise<InboxResponse> {
  const url = new URL(endpoint)
  if (cursor) url.searchParams.set('cursor', cursor)
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`收件箱请求失败：HTTP ${res.status}`)
  const data = (await res.json()) as InboxResponse
  if (!Array.isArray(data.items)) throw new Error('收件箱响应格式不正确')
  return data
}

/** Convert one email into a library document. Returns null when the mail has no usable body. */
export async function itemToDocument(item: InboxItem): Promise<DocumentEntity | null> {
  const url = item.url || `inbox://${item.id}`
  const meta = { title: item.subject, author: item.from, publishedAt: item.receivedAt }

  let markdown = ''
  if (item.html?.trim()) {
    markdown = (await extractFromHtml(item.html, url, meta)).markdown
  } else if (item.text?.trim()) {
    markdown = item.text.trim()
  }
  if (!markdown.trim()) return null

  const contentHash = await computeHash(markdown)
  const now = dayjs().toISOString()
  return {
    id: contentHash,
    url,
    title: item.subject || '(无主题)',
    siteName: item.from,
    author: item.from,
    description: undefined,
    publishedAt: item.receivedAt,
    markdown,
    wordCount: countWords(markdown),
    tokenCount: estimateTokens(markdown),
    contentHash,
    extractionMethod: 'rss',
    source: 'library',
    tags: ['newsletter'],
    capturedAt: now,
    updatedAt: now,
  }
}

export interface PollResult {
  /** Emails converted into library documents this run. */
  collected: number
  /** Emails skipped (no body / duplicate hash). */
  skipped: number
  error?: string
}

/**
 * Poll the configured inbox once: fetch new items since the stored cursor,
 * convert and persist them (dedup via contentHash id), then advance the
 * cursor. Best-effort per item — one bad email never aborts the batch.
 */
export async function pollInbox(): Promise<PollResult> {
  const settings = await SettingsRepository.get()
  const inbox: InboxSettings | undefined = settings?.inbox
  if (!inbox?.enabled || !inbox.endpoint) {
    return { collected: 0, skipped: 0 }
  }

  const cursor = await MetaRepository.get<string>(CURSOR_KEY)
  let response: InboxResponse
  try {
    response = await fetchInboxItems(inbox.endpoint, inbox.token, cursor)
  } catch (e: any) {
    return { collected: 0, skipped: 0, error: e?.message || '收件箱拉取失败' }
  }

  let collected = 0
  let skipped = 0
  for (const item of response.items) {
    try {
      const entity = await itemToDocument(item)
      if (!entity) {
        skipped++
        continue
      }
      const existing = await DocumentRepository.findById(entity.id)
      if (existing) {
        skipped++
      } else {
        await DocumentRepository.save(entity)
        try {
          addToIndex(entity)
        } catch {
          // search index is best-effort
        }
        await enqueueForDocument(entity.id)
        collected++
      }
    } catch {
      skipped++
    }
  }

  if (response.cursor != null) {
    await MetaRepository.set(CURSOR_KEY, response.cursor)
  }
  return { collected, skipped }
}
