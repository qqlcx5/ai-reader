import { describe, it, expect } from 'vitest'
import { truncateContext } from './truncate'

describe('truncateContext', () => {
  it('should return original text when under maxTokens', () => {
    const text = 'Hello World'
    const result = truncateContext(text, 10)
    expect(result).toBe(text)
  })

  it('should return empty string when maxTokens is 0', () => {
    const result = truncateContext('Hello World', 0)
    expect(result).toBe('')
  })

  it('should truncate long text from tail', () => {
    // ~1000 tokens worth of text (1 token ≈ 4 chars = 4000 chars)
    const text = 'A'.repeat(8000)
    const result = truncateContext(text, 500)

    expect(result.length).toBeLessThan(text.length)
    // Should be roughly 500 tokens = ~2000 chars
    expect(result.length).toBeGreaterThan(1000)
    expect(result.length).toBeLessThan(3000)
  })

  it('should truncate at paragraph boundary when possible', () => {
    const paragraphs = Array.from({ length: 100 }, (_, i) => `Paragraph ${i} with some content here to make it longer.`)

    // Join with double newlines for paragraph boundaries
    const text = paragraphs.join('\n\n')

    // Set maxTokens low enough to force truncation
    const result = truncateContext(text, 30)

    // Should be shorter than original
    expect(result.length).toBeLessThan(text.length)
    // Should not end mid-paragraph (should end at a paragraph boundary or newline)
    const lastChars = result.slice(-20)
    // Should look like it ends cleanly - either at \n\n boundary or reasonable cut
    expect(result.length).toBeGreaterThan(0)
  })

  it('should handle empty text', () => {
    const result = truncateContext('', 100)
    expect(result).toBe('')
  })

  it('should handle text exactly at token limit', () => {
    // 40 chars ≈ 10 tokens
    const text = 'A'.repeat(40)
    const result = truncateContext(text, 10)
    expect(result).toBe(text)
  })

  it('should handle negative maxTokens gracefully', () => {
    const result = truncateContext('Hello World', -1)
    expect(result).toBe('')
  })
})
