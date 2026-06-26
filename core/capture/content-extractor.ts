/**
 * Content extraction.
 *
 * The content script calls `extractPageContent(document, url)` to
 * turn the live page DOM into a `CapturedDocument` ready for
 * persistence. The pipeline is:
 *
 *   1. Clone the document so we never mutate the live page.
 *   2. Run defuddle on the clone with `markdown: true`.
 *   3. Pull author/date/favicon/etc. from defuddle's metadata,
 *      falling back to `<meta>` tags when defuddle couldn't find
 *      them.
 *   4. If defuddle throws or returns nothing useful, fall back to
 *      `body.innerText` wrapped in a minimal markdown envelope so
 *      the user still gets *something* to read.
 *
 * The function is intentionally synchronous (defuddle is sync by
 * default) so the content script can keep its `CAPTURE_PAGE`
 * handler returning a plain `{ success, data }` response. The
 * `parseAsync` path is offered for callers that want richer
 * extractors (Reddit / YouTube) — they can opt in via
 * `options.useAsync`.
 */

import Defuddle, { createMarkdownContent } from 'defuddle/full'
import type { CapturedDocument } from '@db/schema'
import type { ExtractOptions, ExtractionResult } from './types'

/** Soft cap for how much rawHtml we keep in IndexedDB. */
const RAW_HTML_MAX = 500_000

/** Default reading speed in words per minute. */
const WORDS_PER_MINUTE = 220

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`
}

function safeGetMeta(
  doc: Document,
  names: string[]
): string | undefined {
  for (const name of names) {
    const el = doc.querySelector(
      `meta[name="${name}"], meta[property="${name}"], meta[property="og:${name}"], meta[name="twitter:${name}"]`
    )
    const content = el?.getAttribute('content')?.trim()
    if (content) return content
  }
  return undefined
}

function pickFavicon(doc: Document, baseUrl: string): string | undefined {
  const link = doc.querySelector('link[rel*="icon"]') as HTMLLinkElement | null
  const href = link?.href
  if (href) return href
  try {
    return new URL('/favicon.ico', baseUrl).toString()
  } catch {
    return undefined
  }
}

function pickLanguage(doc: Document): string | undefined {
  const html = doc.documentElement
  const lang = html?.getAttribute('lang') || html?.getAttribute('xml:lang')
  if (lang) return lang.trim()
  const meta = doc.querySelector('meta[http-equiv="content-language"]')
  return meta?.getAttribute('content')?.trim() || undefined
}

function pickKeywords(doc: Document): string[] | undefined {
  const meta = doc.querySelector('meta[name="keywords"]')
  const raw = meta?.getAttribute('content')
  if (!raw) return undefined
  const parts = raw
    .split(/[,;]+/)
    .map((s) => s.trim())
    .filter(Boolean)
  return parts.length ? parts : undefined
}

function countWords(text: string): number {
  if (!text) return 0
  // Count CJK chars individually + latin words, gives a more
  // honest number for mixed-language articles.
  const cjk = (text.match(/[\u3400-\u9fff]/g) || []).length
  const words = text.replace(/[\u3400-\u9fff]+/g, ' ').match(/\S+/g)?.length ?? 0
  return cjk + words
}

function siteNameFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

function normaliseDate(input: string | undefined | null): string | undefined {
  if (!input) return undefined
  const ts = Date.parse(input)
  if (Number.isNaN(ts)) return input
  return new Date(ts).toISOString()
}

/**
 * Run defuddle on `doc` and return its result, or throw if defuddle
 * is unavailable / blows up. Separated out so tests can mock it.
 */
function runDefuddle(doc: Document, url: string, opts: ExtractOptions) {
  const defuddle = new Defuddle(doc, {
    // `url` is always the actual page URL — `opts.url` is just
    // a caller override hook (rarely needed, e.g. for testing).
    url: opts.url ?? url,
    markdown: opts.markdown ?? true,
    useAsync: opts.useAsync ?? false,
  })
  return opts.useAsync ? defuddle.parseAsync() : Promise.resolve(defuddle.parse())
}

/**
 * Map a defuddle response into a `CapturedDocument`.
 */
function defuddleToDocument(
  response: Awaited<ReturnType<typeof runDefuddle>>,
  fallbackDoc: Document,
  url: string
): CapturedDocument {
  const title =
    response.title || fallbackDoc.title || siteNameFromUrl(url) || 'Untitled'
  const author = response.author || safeGetMeta(fallbackDoc, ['author', 'article:author'])
  const publishedAt = normaliseDate(
    response.published || safeGetMeta(fallbackDoc, ['article:published_time', 'publishedDate', 'pubdate'])
  )
  const description =
    response.description || safeGetMeta(fallbackDoc, ['description', 'og:description'])
  const siteName = response.site || safeGetMeta(fallbackDoc, ['og:site_name', 'application-name']) || siteNameFromUrl(url)
  const favicon = response.favicon || pickFavicon(fallbackDoc, url)
  const image = response.image || safeGetMeta(fallbackDoc, ['og:image', 'twitter:image'])
  const keywords = pickKeywords(fallbackDoc)
  const language = response.language || pickLanguage(fallbackDoc)
  const wordCount = typeof response.wordCount === 'number' && response.wordCount > 0
    ? response.wordCount
    : countWords(response.contentMarkdown || response.content || '')

  // Prefer the markdown string defuddle already produced, otherwise
  // synthesise one from the HTML it returned.
  let markdownContent = response.contentMarkdown || ''
  if (!markdownContent && response.content) {
    try {
      markdownContent = createMarkdownContent(response.content)
    } catch {
      markdownContent = response.content
    }
  }
  if (!markdownContent) markdownContent = ''

  const now = Date.now()
  return {
    id: makeId(),
    url,
    title: String(title),
    author: author || undefined,
    publishedAt: publishedAt || undefined,
    favicon: favicon || undefined,
    description: description || undefined,
    keywords,
    markdownContent,
    rawHtml: undefined, // set by caller if requested
    siteName: siteName || undefined,
    image: image || undefined,
    wordCount,
    language: language || undefined,
    schemaOrgData: response.schemaOrgData,
    createdAt: now,
    updatedAt: now,
  }
}

/**
 * Fallback when defuddle fails: just read the body text.
 */
function fallbackDocument(
  doc: Document,
  url: string,
  reason: string
): CapturedDocument {
  const body = doc.body
  const text = (body?.innerText || body?.textContent || '').trim()
  // Naive markdown: blank lines separate paragraphs, double-space
  // line breaks become `<br>`. It's ugly but it's *something*.
  const markdown = text
    .split(/\n{2,}/)
    .map((p) => p.replace(/\n/g, '  \n').trim())
    .filter(Boolean)
    .join('\n\n')

  const title = doc.title || siteNameFromUrl(url) || 'Untitled'
  const now = Date.now()
  const wordCount = countWords(text)
  return {
    id: makeId(),
    url,
    title,
    author: safeGetMeta(doc, ['author', 'article:author']),
    publishedAt: normaliseDate(
      safeGetMeta(doc, ['article:published_time', 'publishedDate', 'pubdate'])
    ),
    favicon: pickFavicon(doc, url),
    description: safeGetMeta(doc, ['description', 'og:description']),
    keywords: pickKeywords(doc),
    markdownContent: markdown,
    rawHtml: undefined,
    siteName: safeGetMeta(doc, ['og:site_name', 'application-name']) || siteNameFromUrl(url),
    image: safeGetMeta(doc, ['og:image', 'twitter:image']),
    wordCount,
    language: pickLanguage(doc),
    schemaOrgData: undefined,
    createdAt: now,
    updatedAt: now,
  }
}

/**
 * Public entry point used by the content script.
 *
 * @param source  The live `document` (we clone internally).
 * @param url     The page URL (we can't trust `source.location` in
 *                tests / popups).
 * @param options Defuddle options.
 * @param opts.includeRawHtml When true the returned document also
 *                carries a (truncated) `rawHtml` snapshot.
 */
export async function extractPageContent(
  source: Document,
  url: string,
  options: ExtractOptions = {},
  opts: { includeRawHtml?: boolean } = {}
): Promise<ExtractionResult> {
  const started = Date.now()

  // Clone so defuddle's mutations / queries don't disturb the live
  // page (defuddle may remove elements as part of cleaning).
  const cloned: Document = source.cloneNode(true) as Document
  // Clone loses the URL, restore it.
  try {
    const parsed = new URL(url)
    Object.defineProperty(cloned, 'URL', { value: parsed.href, configurable: true })
    Object.defineProperty(cloned, 'documentURI', { value: parsed.href, configurable: true })
    Object.defineProperty(cloned, 'baseURI', { value: parsed.href, configurable: true })
  } catch {
    /* ignore — defuddle will just see an empty URL */
  }

  try {
    const response = await runDefuddle(cloned, url, options)
    const doc = defuddleToDocument(response, source, url)
    if (opts.includeRawHtml) {
      doc.rawHtml = source.documentElement.outerHTML.slice(0, RAW_HTML_MAX)
    }
    return {
      document: doc,
      source: 'defuddle',
      durationMs: Date.now() - started,
    }
  } catch (err) {
    // Defuddle threw — fall back to plain text. We deliberately
    // don't rethrow: a failed extraction should not be a hard
    // failure for the user.
    if (typeof console !== 'undefined') {
      console.warn('[perception] defuddle failed, using fallback:', err)
    }
    const doc = fallbackDocument(source, url, err instanceof Error ? err.message : String(err))
    if (opts.includeRawHtml) {
      doc.rawHtml = source.documentElement.outerHTML.slice(0, RAW_HTML_MAX)
    }
    return {
      document: doc,
      source: 'fallback',
      durationMs: Date.now() - started,
    }
  }
}

/**
 * Estimate reading time in minutes. Exposed so the UI can show
 * "X min read" without recomputing.
 */
export function estimateReadingTime(wordCount: number | undefined): number {
  if (!wordCount || wordCount <= 0) return 0
  return Math.max(1, Math.ceil(wordCount / WORDS_PER_MINUTE))
}

// Re-export for callers that need it without going through defuddle.
export { createMarkdownContent }
