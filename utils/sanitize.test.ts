import { describe, it, expect } from 'vitest'
import { sanitizeHtml, stripHtml } from './sanitize'

describe('utils/sanitize', () => {
  it('should return safe HTML via DOMPurify', () => {
    const safe = sanitizeHtml('<p>Hello</p>')
    expect(safe).toContain('<p>Hello</p>')
  })

  it('should strip dangerous tags', () => {
    const safe = sanitizeHtml('<script>alert("xss")</script><p>text</p>')
    expect(safe).not.toContain('<script>')
    expect(safe).toContain('text')
  })

  it('should strip HTML to plain text', () => {
    const text = stripHtml('<p>Hello <b>World</b></p>')
    expect(text).toBe('Hello World')
  })
})
