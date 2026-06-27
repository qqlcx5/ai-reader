import { describe, it, expect } from 'vitest'
import { contentHash } from './hash'

describe('utils/hash', () => {
  it('should generate a 64-char hex string', async () => {
    const hash = await contentHash('hello')
    expect(hash).toHaveLength(64)
    expect(hash).toMatch(/^[0-9a-f]+$/)
  })

  it('should produce different hashes for different inputs', async () => {
    const h1 = await contentHash('hello')
    const h2 = await contentHash('world')
    expect(h1).not.toBe(h2)
  })

  it('should produce same hash for same input', async () => {
    const h1 = await contentHash('test input')
    const h2 = await contentHash('test input')
    expect(h1).toBe(h2)
  })
})
