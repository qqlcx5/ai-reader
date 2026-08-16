/**
 * Related-document discovery — language-agnostic character-bigram overlap.
 *
 * MiniSearch's tokenizer doesn't split CJK text into useful terms, so instead
 * of the search index we score documents directly: bigrams of the current
 * document's title + excerpt + lead paragraph are matched against the same
 * fields of every other document. Cheap for library-scale sets (hundreds of
 * docs) and works identically for Chinese and Latin text.
 */
import type { DocumentEntity } from '@/types/document'

/** Character bigrams of a string (single chars kept for length-1 strings). */
export function bigrams(text: string): Set<string> {
  const set = new Set<string>()
  const normalized = text.replace(/\s+/g, ' ').trim().toLowerCase()
  if (normalized.length === 1) set.add(normalized)
  for (let i = 0; i < normalized.length - 1; i++) {
    set.add(normalized.slice(i, i + 2))
  }
  return set
}

/** The text that represents a document for similarity: title + excerpt + lead. */
function signatureText(doc: DocumentEntity): string {
  const lead = (doc.markdown || '').slice(0, 600)
  return [doc.title || '', doc.excerpt || '', doc.siteName || '', lead].join(' ')
}

export interface RelatedDoc {
  doc: DocumentEntity
  /** Overlap score, roughly 0–1. Only for ranking; not shown to users. */
  score: number
}

/**
 * Up to `limit` documents most similar to `target`, excluding itself.
 * Only returns scores above a small noise floor.
 */
export function findRelated(target: DocumentEntity, pool: DocumentEntity[], limit = 5): RelatedDoc[] {
  const queryGrams = bigrams(signatureText(target))
  if (queryGrams.size === 0) return []

  const results: RelatedDoc[] = []
  for (const doc of pool) {
    if (doc.id === target.id) continue
    const docGrams = bigrams(signatureText(doc))
    if (docGrams.size === 0) continue
    let overlap = 0
    for (const g of queryGrams) {
      if (docGrams.has(g)) overlap++
    }
    const score = overlap / Math.sqrt(queryGrams.size * docGrams.size)
    if (score > 0.05) results.push({ doc, score })
  }

  results.sort((a, b) => b.score - a.score)
  return results.slice(0, limit)
}
