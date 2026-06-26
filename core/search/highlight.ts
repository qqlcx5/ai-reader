/**
 * Highlight / snippet helpers used by the search layer.
 *
 * MiniSearch v7 does not ship a built-in `highlight()` helper
 * (it has one in earlier majors but the surface is gone). We
 * therefore implement a small, predictable function that takes a
 * list of matched terms and produces a single HTML-safe snippet
 * with `<mark>` wrappers around every occurrence. The snippet
 * shows the first match with up to `contextChars` of context on
 * each side; if there are more matches, we append `…` to hint at
 * the truncation.
 *
 * The output is plain HTML (markers only), never a full DOM
 * fragment, so callers are free to render it through Vue's
 * `v-html` or whatever template engine they prefer after passing
 * it through their sanitizer of choice.
 */

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

function escapeHtml(input: string): string {
  return input.replace(/[&<>"']/g, (c) => HTML_ESCAPES[c] ?? c)
}

/** Escape a string so it can be used inside a `RegExp`. */
function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export interface SnippetOptions {
  /** Context size (chars) before and after the match. Default 50. */
  contextChars?: number
  /** Maximum snippet length. Default 240. */
  maxLength?: number
  /** Highlight tag opening (default `<mark>`). */
  openTag?: string
  /** Highlight tag closing (default `</mark>`). */
  closeTag?: string
  /** Max number of distinct match positions to highlight. */
  maxMatches?: number
}

const DEFAULTS: Required<SnippetOptions> = {
  contextChars: 50,
  maxLength: 240,
  openTag: '<mark>',
  closeTag: '</mark>',
  maxMatches: 6,
}

/** Split the user query into individual search terms. */
export function tokenizeQuery(query: string): string[] {
  return query
    .split(/\s+/u)
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
}

/**
 * Build a regex matching any of the supplied terms. The regex
 * is case-insensitive and global so `String.matchAll` can pull
 * every position out in one pass.
 */
function buildMatchRegex(terms: string[]): RegExp | null {
  const cleaned = terms
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
    .map(escapeRegExp)
  if (cleaned.length === 0) return null
  // Sort longest-first so overlapping terms (e.g. "react" vs
  // "reactivity") don't get partially shadowed.
  cleaned.sort((a, b) => b.length - a.length)
  return new RegExp(`(${cleaned.join('|')})`, 'giu')
}

/**
 * Compute the snippet boundaries around the first match.
 *
 * Returns `[start, end]` indices in the original text. The
 * window is shrunk to respect `maxLength` if necessary, and is
 * always extended to a word boundary on each side so the output
 * doesn't start/end mid-word.
 */
function findWindow(
  text: string,
  matchIndex: number,
  matchLength: number,
  options: Required<SnippetOptions>
): { start: number; end: number } {
  const textLen = text.length
  const halfWindow = Math.floor(options.maxLength / 2)
  const desiredStart = Math.max(0, matchIndex - halfWindow)
  const desiredEnd = Math.min(textLen, desiredStart + options.maxLength)
  const start = Math.min(
    desiredStart,
    Math.max(0, matchIndex - options.contextChars)
  )
  const end = Math.min(textLen, Math.max(desiredEnd, matchIndex + matchLength + options.contextChars))
  return { start, end }
}

/** Expand `[start, end]` outward to the previous/next whitespace
 *  boundary so the snippet doesn't start/end mid-word. */
function snapToWordBoundaries(
  text: string,
  start: number,
  end: number
): { start: number; end: number } {
  if (start > 0) {
    const ws = text.lastIndexOf(' ', start)
    const nl = text.lastIndexOf('\n', start)
    const boundary = Math.max(ws, nl)
    if (boundary > start - 30 && boundary >= 0) {
      start = boundary + 1
    }
  }
  if (end < text.length) {
    const ws = text.indexOf(' ', end)
    const nl = text.indexOf('\n', end)
    let boundary = -1
    if (ws === -1) boundary = nl
    else if (nl === -1) boundary = ws
    else boundary = Math.min(ws, nl)
    if (boundary !== -1 && boundary < end + 30) {
      end = boundary
    }
  }
  return { start, end }
}

/**
 * Extract a single snippet with the matched terms wrapped in
 * `<mark>` (or whatever tags the caller provided).
 *
 * Returns an empty string if `text` is empty or no term matches.
 */
export function buildSnippet(
  text: string,
  query: string,
  options: SnippetOptions = {}
): string {
  if (!text) return ''
  const opts: Required<SnippetOptions> = { ...DEFAULTS, ...options }
  const terms = tokenizeQuery(query)
  const regex = buildMatchRegex(terms)
  if (!regex) {
    return truncate(escapeHtml(text), opts.maxLength)
  }
  const matches = Array.from(text.matchAll(regex))
  if (matches.length === 0) {
    return truncate(escapeHtml(text), opts.maxLength)
  }
  const first = matches[0]
  const firstIndex = first.index ?? 0
  const firstLength = first[0]?.length ?? 0
  let { start, end } = findWindow(text, firstIndex, firstLength, opts)
  ;({ start, end } = snapToWordBoundaries(text, start, end))
  // Clamp the window so it never exceeds maxLength even if both
  // word boundaries pushed outward.
  if (end - start > opts.maxLength) {
    end = start + opts.maxLength
  }
  const before = start > 0 ? '… ' : ''
  const after = end < text.length ? ' …' : ''
  const slice = text.slice(start, end)
  // Build the highlighted slice.
  const sliceLower = slice.toLowerCase()
  const highlighted: string[] = []
  let cursor = 0
  let highlightedCount = 0
  for (const m of matches) {
    const idx = m.index ?? 0
    if (idx < start || idx >= end) continue
    if (highlightedCount >= opts.maxMatches) break
    const localStart = idx - start
    const localEnd = localStart + (m[0]?.length ?? 0)
    if (localStart < cursor) continue // overlap, already covered
    if (localStart > cursor) {
      highlighted.push(escapeHtml(slice.slice(cursor, localStart)))
    }
    highlighted.push(opts.openTag)
    highlighted.push(escapeHtml(slice.slice(localStart, localEnd)))
    highlighted.push(opts.closeTag)
    cursor = localEnd
    highlightedCount += 1
  }
  if (cursor < slice.length) {
    highlighted.push(escapeHtml(slice.slice(cursor)))
  }
  // Suppress an unused-variable lint warning for the cached
  // lowercased slice (kept for future relevance tweaks).
  void sliceLower
  return before + highlighted.join('') + after
}

function truncate(s: string, maxLength: number): string {
  if (s.length <= maxLength) return s
  return s.slice(0, maxLength) + '…'
}

/**
 * Highlight a (short) text with the search query, returning a
 * safe HTML fragment. Used for titles and other inline labels
 * where the snippet-window logic of `buildSnippet` would be
 * overkill.
 */
export function highlightTitle(text: string, query: string): string {
  if (!text) return ''
  if (!query) return escapeHtml(text)
  const terms = tokenizeQuery(query)
  const regex = buildMatchRegex(terms)
  if (!regex) return escapeHtml(text)
  // Walk matches left-to-right and interleave with escaped
  // fragments. This is more robust than a single replace()
  // because it handles overlapping terms correctly.
  const matches = Array.from(text.matchAll(regex))
  if (matches.length === 0) return escapeHtml(text)
  const out: string[] = []
  let cursor = 0
  for (const m of matches) {
    const idx = m.index ?? 0
    if (idx < cursor) continue
    if (idx > cursor) {
      out.push(escapeHtml(text.slice(cursor, idx)))
    }
    out.push('<mark>')
    out.push(escapeHtml(text.slice(idx, idx + (m[0]?.length ?? 0))))
    out.push('</mark>')
    cursor = idx + (m[0]?.length ?? 0)
  }
  if (cursor < text.length) {
    out.push(escapeHtml(text.slice(cursor)))
  }
  return out.join('')
}

/**
 * Combine multiple term matches into a single, non-overlapping
 * list of highlight ranges on the original text. The ranges are
 * inclusive on both ends, suitable for use by any text renderer
 * that doesn't have a `matchAll`-style API.
 */
export interface HighlightRange {
  start: number
  end: number
  term: string
}

export function mergeHighlightRanges(
  text: string,
  terms: string[]
): HighlightRange[] {
  const regex = buildMatchRegex(terms)
  if (!regex) return []
  const ranges: HighlightRange[] = []
  for (const m of text.matchAll(regex)) {
    if (m.index === undefined) continue
    const last = ranges[ranges.length - 1]
    const start = m.index
    const end = start + (m[0]?.length ?? 0)
    if (last && start < last.end) {
      // Merge overlapping ranges.
      last.end = Math.max(last.end, end)
      last.term = last.term.length >= (m[0]?.length ?? 0) ? last.term : (m[0] ?? last.term)
      continue
    }
    ranges.push({ start, end, term: m[0] ?? '' })
  }
  return ranges
}
