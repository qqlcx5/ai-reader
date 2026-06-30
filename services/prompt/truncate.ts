import { estimateTokens } from '@/utils/token'

/**
 * Truncate markdown to fit within a token budget.
 *
 * Keeps whole paragraphs from the top (usually the most relevant part of a
 * captured page) until the budget is exhausted, then hard-cuts the next
 * paragraph near a sentence/line boundary so the result stays close to the
 * budget without splitting mid-word. Per-paragraph costs use the CJK-aware
 * estimator, so Chinese content is budgeted correctly.
 */
export function truncateContext(markdown: string, maxTokens: number): string {
  if (maxTokens <= 0) return ''
  if (!markdown) return ''
  if (estimateTokens(markdown) <= maxTokens) return markdown

  const paragraphs = markdown.split(/\n\n+/).filter(Boolean)
  const kept: string[] = []
  let budgetLeft = maxTokens

  for (const para of paragraphs) {
    const cost = estimateTokens(para)
    if (cost <= budgetLeft) {
      kept.push(para)
      budgetLeft -= cost
      continue
    }
    // This paragraph doesn't fully fit — hard-cut it to the remaining budget,
    // then stop.
    const head = sliceToTokenBudget(para, budgetLeft)
    if (head) kept.push(head)
    break
  }

  return kept.join('\n\n')
}

/**
 * Take a prefix of `text` estimated to fit within `budget` tokens, preferring a
 * CJK/Latin sentence end or a line boundary so the cut stays clean.
 */
function sliceToTokenBudget(text: string, budget: number): string {
  if (budget <= 0) return ''
  const cost = estimateTokens(text)
  if (cost <= budget) return text

  const targetLen = Math.floor((text.length * budget) / cost)
  if (targetLen <= 0) return ''

  const slice = text.slice(0, targetLen)
  let boundary = -1
  for (const sep of ['。', '！', '？', '. ', '! ', '? ', '\n']) {
    const idx = slice.lastIndexOf(sep)
    if (idx > boundary) boundary = idx
  }
  if (boundary >= targetLen * 0.5) {
    return slice.slice(0, boundary + 1).trimEnd()
  }
  return slice.trimEnd()
}
