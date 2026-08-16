import type { FlashcardEntity } from '@/types/flashcard'

/**
 * Export flashcards as an Anki-importable TSV text file.
 *
 * Anki (File > Import) recognises the `#`-prefixed headers:
 * tab-separated, HTML rendered (so multi-line fields become <br>).
 */
export function exportFlashcardsToAnkiTxt(cards: FlashcardEntity[]): Blob {
  const escape = (s: string): string =>
    s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\t/g, ' ')
      .replace(/\r?\n/g, '<br>')

  const lines = [
    '#separator:tab',
    '#html:true',
    ...cards.map((c) => `${escape(c.front)}\t${escape(c.back)}`),
  ]
  return new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' })
}
