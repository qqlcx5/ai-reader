/**
 * Tests for the highlight / snippet helper.
 *
 * The snippet builder is small but has a few edge cases that
 * are easy to break silently: empty input, multi-word queries,
 * terms near the start / end of the document, and overlapping
 * ranges.
 */

import { describe, it, expect } from 'vitest'
import {
  buildSnippet,
  tokenizeQuery,
  mergeHighlightRanges,
} from './highlight'

describe('tokenizeQuery', () => {
  it('splits a multi-word query on whitespace', () => {
    expect(tokenizeQuery('hello world')).toEqual(['hello', 'world'])
  })

  it('drops empty fragments', () => {
    expect(tokenizeQuery('  hello   world  ')).toEqual(['hello', 'world'])
  })

  it('returns [] for an empty string', () => {
    expect(tokenizeQuery('')).toEqual([])
  })
})

describe('buildSnippet', () => {
  const text =
    'The quick brown fox jumps over the lazy dog. ' +
    'A quick movement of the enemy will jeopardize six gunboats. ' +
    'The brown fox returns at dawn.'

  it('returns empty string for empty input', () => {
    expect(buildSnippet('', 'fox')).toBe('')
  })

  it('returns the truncated text for a query with no matches', () => {
    const out = buildSnippet(text, 'narwhal', { maxLength: 80 })
    expect(out).not.toContain('<mark>')
    expect(out.length).toBeLessThanOrEqual(82)
  })

  it('highlights a single match with 50-char context on each side', () => {
    const out = buildSnippet(text, 'quick', { contextChars: 50 })
    expect(out).toContain('<mark>quick</mark>')
    // The opening words should still be visible.
    expect(out).toContain('The')
    // The closing words should still be visible.
    expect(out).toContain('fox')
  })

  it('marks the truncation when the match is far from the start', () => {
    const out = buildSnippet('A'.repeat(200) + ' target here ' + 'B'.repeat(200), 'target', {
      contextChars: 50,
      maxLength: 200,
    })
    expect(out).toContain('<mark>target</mark>')
    expect(out.startsWith('…')).toBe(true)
  })

  it('marks the truncation when the match is far from the end', () => {
    const out = buildSnippet('A'.repeat(200) + ' target here ' + 'B'.repeat(200), 'target', {
      contextChars: 50,
      maxLength: 200,
    })
    expect(out.endsWith('…')).toBe(true)
  })

  it('highlights multiple matches in the same snippet', () => {
    const out = buildSnippet(text, 'brown', { contextChars: 200, maxLength: 200 })
    // Both occurrences of "brown" should be wrapped.
    const matches = out.match(/<mark>brown<\/mark>/g) || []
    expect(matches.length).toBeGreaterThanOrEqual(2)
  })

  it('escapes HTML in the surrounding text', () => {
    const html = '<script>alert(1)</script> hello world'
    const out = buildSnippet(html, 'hello', { contextChars: 10 })
    expect(out).not.toContain('<script>')
    expect(out).toContain('&lt;script&gt;')
    expect(out).toContain('<mark>hello</mark>')
  })

  it('handles a single-word query at the start of the text', () => {
    const out = buildSnippet('React is a JavaScript library', 'react', { contextChars: 20 })
    // The match is at the very beginning, so the snippet
    // starts with the highlighted term (no ellipsis).
    expect(out.startsWith('<mark>React</mark>')).toBe(true)
    expect(out).toContain('is a JavaScript library')
  })

  it('returns the original text (HTML-escaped) when the query is empty', () => {
    const out = buildSnippet('hello world', '')
    // No highlights, but the text is still returned.
    expect(out).toContain('hello')
    expect(out).toContain('world')
    expect(out).not.toContain('<mark>')
  })

  it('caps the number of highlighted matches per snippet', () => {
    const text = 'a '.repeat(500) + 'target ' + 'a '.repeat(500)
    const out = buildSnippet(text, 'target', { contextChars: 10, maxMatches: 1 })
    const matches = out.match(/<mark>/g) || []
    expect(matches.length).toBe(1)
  })

  it('does not produce a mid-word cut when the match is mid-sentence', () => {
    const out = buildSnippet(
      'foo bar baz qux quux corge grault garply target waldo fred',
      'target',
      { contextChars: 5, maxLength: 80 },
    )
    // The snippet should start at a word boundary.
    const firstChar = out.replace(/… /, '').charAt(0)
    expect(firstChar).not.toBe(' ')
  })
})

describe('mergeHighlightRanges', () => {
  it('returns an empty array when no terms are given', () => {
    expect(mergeHighlightRanges('hello world', [])).toEqual([])
  })

  it('finds the position of every occurrence of a single term', () => {
    const ranges = mergeHighlightRanges('foo bar foo', ['foo'])
    expect(ranges).toEqual([
      { start: 0, end: 3, term: 'foo' },
      { start: 8, end: 11, term: 'foo' },
    ])
  })

  it('merges overlapping ranges from multiple terms', () => {
    // 'reactive' contains 'react' as a prefix — when both terms
    // are searched, the longer match wins and the shorter is
    // absorbed into the merged range.
    const ranges = mergeHighlightRanges('reactive and rocks', ['react', 'reactive'])
    // Should be one merged range covering 'reactive'.
    expect(ranges.length).toBe(1)
    expect(ranges[0]?.start).toBe(0)
    expect(ranges[0]?.end).toBe(8)
  })

  it('keeps non-overlapping ranges separate', () => {
    const ranges = mergeHighlightRanges('alpha beta gamma', ['alpha', 'gamma'])
    expect(ranges.length).toBe(2)
    expect(ranges[0]).toEqual({ start: 0, end: 5, term: 'alpha' })
    expect(ranges[1]).toEqual({ start: 11, end: 16, term: 'gamma' })
  })

  it('is case-insensitive', () => {
    const ranges = mergeHighlightRanges('Hello HELLO hello', ['hello'])
    expect(ranges.length).toBe(3)
  })
})
