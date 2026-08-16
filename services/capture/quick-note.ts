/**
 * Quick notes — save the current page selection as a document straight from
 * the background (context menu "Save selection to AuraMind"), no panel needed.
 */
import dayjs from 'dayjs'
import { computeHash, countWords } from '@/utils/content/extract'
import { estimateTokens } from '@/utils/token'
import { DocumentRepository } from '@/db/repositories/document.repository'
import { enqueueForDocument } from '@/services/ai-job/queue'
import type { DocumentEntity } from '@/types/document'

export interface QuickNoteInput {
  selection: string
  pageUrl: string
  pageTitle: string
}

/** Build a quote-style quick-note document (pure — for tests). */
export async function buildQuickNote(input: QuickNoteInput): Promise<DocumentEntity> {
  const { selection, pageUrl, pageTitle } = input
  const quote = selection
    .trim()
    .split(/\r?\n/)
    .map((line) => `> ${line.trim()}`)
    .join('\n')
  const title = `${pageTitle || pageUrl} · 选段`
  const markdown = `# ${title}\n\n${quote}\n\n[查看原文](${pageUrl})`

  const contentHash = await computeHash(markdown)
  const now = dayjs().toISOString()
  return {
    id: contentHash,
    url: pageUrl,
    title,
    markdown,
    wordCount: countWords(markdown),
    tokenCount: estimateTokens(markdown),
    contentHash,
    extractionMethod: 'manual',
    source: 'library',
    tags: ['quick-note'],
    capturedAt: now,
    updatedAt: now,
  }
}

/** Build, persist, and enqueue a quick note. Returns the saved entity.
 *  (Search index is skipped: the panel owns the in-memory index and rebuilds
 *  it from IndexedDB on load.) */
export async function saveQuickNote(input: QuickNoteInput): Promise<DocumentEntity> {
  const entity = await buildQuickNote(input)
  const saved = await DocumentRepository.save(entity)
  await enqueueForDocument(saved.id)
  return saved
}
