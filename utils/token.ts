/**
 * Simple token estimation:
 * - English: ~4 characters per token
 * - Chinese: ~1.5 characters per token
 */

const CHINESE_RE = /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g
const ENGLISH_TOKEN_RATIO = 4
const CHINESE_TOKEN_RATIO = 1.5

export function estimateTokens(text: string): number {
  const chineseChars = (text.match(CHINESE_RE) || []).length
  const otherChars = text.length - chineseChars
  return Math.ceil(chineseChars / CHINESE_TOKEN_RATIO + otherChars / ENGLISH_TOKEN_RATIO)
}
