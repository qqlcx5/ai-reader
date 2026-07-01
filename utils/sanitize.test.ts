import { describe, it, expect } from 'vitest'
import { stripHtml } from './sanitize'

describe('utils/sanitize', () => {
  it('should strip HTML to plain text', () => {
    const text = stripHtml('<p>Hello <b>World</b></p>')
    expect(text).toBe('Hello World')
  })
})
