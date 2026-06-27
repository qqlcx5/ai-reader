import { describe, it, expect } from 'vitest'
import { estimateTokens } from './token'

describe('utils/token', () => {
  it('should estimate tokens for English text', () => {
    const tokens = estimateTokens('Hello world this is a test')
    expect(tokens).toBeGreaterThan(0)
    // 28 chars / 4 = 7 tokens
    expect(tokens).toBe(7)
  })

  it('should estimate tokens for Chinese text', () => {
    const tokens = estimateTokens('这是一段中文测试文本')
    expect(tokens).toBeGreaterThan(0)
    // 10 chars / 1.5 ≈ 6.67 → ceil = 7
    expect(tokens).toBe(7)
  })

  it('should estimate tokens for mixed text', () => {
    const tokens = estimateTokens('Hello 你好 World 世界')
    // English: 13 chars / 4 = 3.25, Chinese: 4 chars / 1.5 ≈ 2.67 → ceil = 6
    expect(tokens).toBe(6)
  })

  it('should return 0 for empty string', () => {
    expect(estimateTokens('')).toBe(0)
  })
})
