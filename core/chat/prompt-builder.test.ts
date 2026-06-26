/**
 * prompt-builder unit tests.
 *
 * The tests cover:
 *  - template variable substitution
 *  - long markdown truncation
 *  - history ordering and content layout
 *  - edge cases: empty system prompt, empty history, etc.
 */

import { describe, it, expect } from 'vitest'
import {
  buildMessages,
  buildDocumentContext,
  applyTemplateVariables,
  truncateDocumentBody,
  MAX_DOC_CHARS,
} from './prompt-builder'
import type { CapturedDocument, ChatHistoryMessage } from '@db/schema'

function makeDoc(overrides: Partial<CapturedDocument> = {}): CapturedDocument {
  return {
    id: 'doc-1',
    url: 'https://example.com/article',
    title: 'Test Article',
    siteName: 'Example',
    publishedAt: '2025-01-01',
    markdownContent: '# Heading\n\nSome content here.',
    wordCount: 42,
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_000_000,
    ...overrides,
  }
}

describe('applyTemplateVariables', () => {
  it('replaces every supported placeholder', () => {
    const doc = makeDoc({ title: 'My Title', url: 'https://example.com/article', language: 'en' })
    const out = applyTemplateVariables(
      'date={{date}} dt={{datetime}} url={{url}} title={{title}} lang={{language}}',
      { document: doc, now: 1_700_000_000_000 }
    )
    expect(out).toContain('date=2023-11-15')
    expect(out).toContain('dt=2023-11-15')
    expect(out).toContain('url=https://example.com/article')
    expect(out).toContain('title=My Title')
    expect(out).toContain('lang=en')
  })

  it('leaves unknown placeholders untouched', () => {
    const out = applyTemplateVariables('{{nope}} {{title}}', {
      document: makeDoc({ title: 'T' }),
    })
    expect(out).toContain('{{nope}}')
    expect(out).toContain('T')
  })

  it('handles whitespace inside the braces', () => {
    const out = applyTemplateVariables('{{  title  }}', { document: makeDoc({ title: 'X' }) })
    expect(out).toBe('X')
  })
})

describe('truncateDocumentBody', () => {
  it('returns the body unchanged when it is short enough', () => {
    const body = 'short body'
    expect(truncateDocumentBody(body, 100)).toBe(body)
  })

  it('truncates oversized content and adds a notice', () => {
    const body = 'a'.repeat(10_000)
    const out = truncateDocumentBody(body, 100)
    expect(out.length).toBeLessThan(2_000) // 100 chars + notice
    expect(out).toContain('[truncated')
    expect(out).toContain('10000 chars')
  })
})

describe('buildDocumentContext', () => {
  it('includes metadata lines and the body', () => {
    const out = buildDocumentContext(
      makeDoc({ title: 'Hello', siteName: 'Example', wordCount: 100 })
    )
    expect(out).toContain('# Document context')
    expect(out).toContain('Title: Hello')
    expect(out).toContain('URL: https://example.com/article')
    expect(out).toContain('Site: Example')
    expect(out).toContain('Word count: 100')
    expect(out).toContain('# Heading')
  })

  it('truncates the body when the markdown is huge', () => {
    const doc = makeDoc({ markdownContent: 'x'.repeat(MAX_DOC_CHARS * 5) })
    const out = buildDocumentContext(doc)
    expect(out).toContain('[truncated')
    expect(out.length).toBeLessThan(MAX_DOC_CHARS * 2)
  })

  it('falls back to content when markdownContent is missing', () => {
    const doc = makeDoc({ markdownContent: '', content: 'plain text fallback' })
    // Force the type because the persisted schema doesn't include `content`
    const out = buildDocumentContext(doc as CapturedDocument)
    expect(out).toContain('plain text fallback')
  })
})

describe('buildMessages', () => {
  it('assembles system + document-context + history + question in that order', () => {
    const doc = makeDoc()
    const history: ChatHistoryMessage[] = [
      { id: 'h1', role: 'user', content: 'first q', createdAt: 1 },
      { id: 'h2', role: 'assistant', content: 'first a', createdAt: 2 },
    ]
    const msgs = buildMessages(
      doc,
      'follow-up?',
      history,
      'You are a helpful assistant. Today is {{date}}.'
    )
    // system + doc-context + 2 history + 1 question = 5
    expect(msgs).toHaveLength(5)
    expect(msgs[0].role).toBe('system')
    expect(msgs[0].content).toMatch(/Today is \d{4}-\d{2}-\d{2}\./)
    expect(msgs[1].role).toBe('user')
    expect(msgs[1].content).toContain('Document context')
    expect(msgs[1].content).toContain('Title: Test Article')
    expect(msgs[2].role).toBe('user')
    expect(msgs[2].content).toBe('first q')
    expect(msgs[3].role).toBe('assistant')
    expect(msgs[3].content).toBe('first a')
    expect(msgs[4].role).toBe('user')
    expect(msgs[4].content).toBe('follow-up?')
  })

  it('omits the system message when the prompt is empty', () => {
    const msgs = buildMessages(makeDoc(), 'q?', [], '')
    expect(msgs.find((m) => m.role === 'system')).toBeUndefined()
    expect(msgs[0].role).toBe('user')
    expect(msgs[0].content).toContain('Document context')
  })

  it('keeps history in chronological order', () => {
    const history: ChatHistoryMessage[] = [
      { id: '1', role: 'user', content: 'A', createdAt: 1 },
      { id: '2', role: 'assistant', content: 'B', createdAt: 2 },
      { id: '3', role: 'user', content: 'C', createdAt: 3 },
    ]
    const msgs = buildMessages(makeDoc(), 'Q', history, 'sys')
    const userAsst = msgs.filter((m) => m.role !== 'system')
    // 1 doc-context, 3 history, 1 question = 5
    expect(userAsst).toHaveLength(5)
    expect(userAsst[1].content).toBe('A')
    expect(userAsst[2].content).toBe('B')
    expect(userAsst[3].content).toBe('C')
    expect(userAsst[4].content).toBe('Q')
  })

  it('drops empty history messages', () => {
    const history: ChatHistoryMessage[] = [
      { id: '1', role: 'user', content: '   ', createdAt: 1 },
      { id: '2', role: 'assistant', content: 'real answer', createdAt: 2 },
    ]
    const msgs = buildMessages(makeDoc(), 'Q', history, 'sys')
    expect(msgs.find((m) => m.content === '   ')).toBeUndefined()
    expect(msgs.find((m) => m.content === 'real answer')).toBeTruthy()
  })

  it('always emits the question, even with empty history', () => {
    const msgs = buildMessages(makeDoc(), 'what is this about?', [], 'sys')
    const last = msgs[msgs.length - 1]
    expect(last.role).toBe('user')
    expect(last.content).toBe('what is this about?')
  })
})
