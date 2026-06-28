/**
 * Estimate token count: ~1 token per 4 characters (rough approximation).
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

/**
 * Truncate markdown text to fit within maxTokens.
 * Cuts from the tail if the estimated token count exceeds maxTokens.
 */
export function truncateContext(markdown: string, maxTokens: number): string {
  if (maxTokens <= 0) return ''

  const estimated = estimateTokens(markdown)
  if (estimated <= maxTokens) return markdown

  // Approximate: keep a proportion of characters matching the token ratio
  const ratio = maxTokens / estimated
  const targetLength = Math.floor(markdown.length * ratio)

  // Try to cut at a paragraph boundary (double newline) for cleaner truncation
  const truncated = markdown.slice(0, targetLength)
  const lastParaBreak = truncated.lastIndexOf('\n\n')

  if (lastParaBreak > targetLength * 0.9) {
    return truncated.slice(0, lastParaBreak)
  }

  // Fallback: cut at last newline
  const lastNewline = truncated.lastIndexOf('\n')
  if (lastNewline > targetLength * 0.9) {
    return truncated.slice(0, lastNewline)
  }

  return truncated
}
