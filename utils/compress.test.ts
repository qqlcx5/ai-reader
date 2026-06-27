import { describe, it, expect } from 'vitest'
import { compressText, decompressText } from './compress'

describe('utils/compress', () => {
  it('should compress and decompress text', () => {
    const original = 'Hello world this is a test string for compression'
    const compressed = compressText(original)
    expect(typeof compressed).toBe('string')
    const decompressed = decompressText(compressed)
    expect(decompressed).toBe(original)
  })

  it('should handle empty string', () => {
    const compressed = compressText('')
    const decompressed = decompressText(compressed)
    expect(decompressed).toBe('')
  })

  it('should handle Chinese text', () => {
    const original = '这是一段中文测试文本，用于测试压缩功能'
    const compressed = compressText(original)
    const decompressed = decompressText(compressed)
    expect(decompressed).toBe(original)
  })
})
