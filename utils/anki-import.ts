import type { FlashcardEntity } from '@/types/flashcard'
import { initialSm2State } from '@/utils/sm2'

/**
 * Import flashcards from an Anki-exported plain-text file (tab-separated
 * Front<tab>Back, the same format `exportFlashcardsToAnkiTxt` produces).
 *
 * - `#`-prefixed header lines (Anki import directives) are skipped
 * - `<br>` is converted back to newlines; HTML entities are unescaped
 * - rows without a back side become cloze-style cards only if they contain
 *   `____`; otherwise they are skipped
 */
export interface AnkiImportResult {
  cards: FlashcardEntity[]
  /** Rows skipped (malformed / no back side / no blank). */
  skipped: number
}

export function parseAnkiTsv(text: string, documentId = 'imported'): AnkiImportResult {
  const unescape = (s: string) =>
    s
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')

  const skipped: string[] = []
  const rows: Array<{ front: string; back: string; type: 'qa' | 'cloze' }> = []

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const tab = line.indexOf('\t')
    const front = unescape(tab === -1 ? line : line.slice(0, tab)).trim()
    const back = tab === -1 ? '' : unescape(line.slice(tab + 1)).trim()
    if (!front) {
      skipped.push(line)
      continue
    }
    if (back) {
      rows.push({ front, back, type: 'qa' })
    } else if (front.includes('____')) {
      // Cloze export keeps the blank in front and the key on the back;
      // a bare front with a blank has no answer — skip.
      skipped.push(line)
    } else {
      skipped.push(line)
    }
  }

  const now = new Date().toISOString()
  const cards: FlashcardEntity[] = []
  const seen = new Set<string>()
  for (const row of rows) {
    const key = frontKey(row.front)
    if (seen.has(key)) {
      skipped.push(row.front)
      continue
    }
    seen.add(key)
    cards.push({
      id: crypto.randomUUID(),
      documentId,
      front: row.front,
      back: row.back,
      source: 'manual',
      type: row.type,
      sm2: initialSm2State(),
      createdAt: now,
      updatedAt: now,
    })
  }

  return { cards, skipped: skipped.length }
}

function frontKey(front: string): string {
  return front.trim().toLowerCase().replace(/\s+/g, '')
}

/** Remove cards whose front already exists in the library. Returns new count. */
export function dedupeAgainst(cards: FlashcardEntity[], existing: FlashcardEntity[]): FlashcardEntity[] {
  const keys = new Set(existing.map((c) => frontKey(c.front)))
  return cards.filter((c) => !keys.has(frontKey(c.front)))
}
