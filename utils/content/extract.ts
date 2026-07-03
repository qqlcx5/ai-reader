import Defuddle from 'defuddle'
import { createMarkdownContent } from 'defuddle/full'
import { estimateTokens } from '../token'
import type { ExtractionMethod } from '@/types/document'

/**
 * Word counter that handles CJK text correctly.
 *
 * `markdown.split(/\s+/)` only works for space-delimited languages.
 * Chinese/Japanese/Korean text has no spaces between characters, so a
 * 500-character article gets counted as ~1 "word".
 *
 * Strategy: strip markdown syntax, then count:
 *   - CJK characters: each character = 1 word
 *   - Non-CJK: split by whitespace as usual
 */
function countWords(text: string): number {
  // Remove markdown syntax (headers, links, images, code fences, etc.)
  const stripped = text
    .replace(/```[\s\S]*?```/g, ' ')   // code blocks
    .replace(/`[^`]+`/g, ' ')          // inline code
    .replace(/!\[[^\]]*\]\([^)]+\)/g, ' ')  // images
    .replace(/\[[^\]]*\]\([^)]+\)/g, ' ')   // links → keep link text only
    .replace(/[#>*_~-]/g, ' ')          // markdown markers
    .replace(/\n+/g, ' ')

  // Count CJK characters (each = 1 word)
  const cjkMatches = stripped.match(/[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/g)
  const cjkCount = cjkMatches ? cjkMatches.length : 0

  // Remove CJK, then count remaining whitespace-delimited words
  const nonCjk = stripped.replace(/[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/g, ' ')
  const nonCjkWords = nonCjk.split(/\s+/).filter(Boolean).length

  return cjkCount + nonCjkWords
}

// ---------------------------------------------------------------------------
// Types — matches the AuraMind internal data model
// ---------------------------------------------------------------------------

export interface ExtractedPageData {
  url: string
  title: string
  markdown: string
  siteName?: string
  author?: string
  description?: string
  publishedAt?: string
  canonicalUrl?: string
  contentHash: string
  wordCount: number
  tokenCount: number
  extractionMethod: ExtractionMethod
}

// ---------------------------------------------------------------------------
// SHA-256 hash for content deduplication
// ---------------------------------------------------------------------------

export async function computeHash(text: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(text)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

// ---------------------------------------------------------------------------
// HTML cleaning — aligned with obsidian-clipper's approach:
//   Remove <script> and <style> elements
//   Remove style attributes
//   Resolve relative URLs to absolute
//   NO DOMPurify — it strips too much (images, tables, etc.)
// ---------------------------------------------------------------------------

export function cleanFullHtml(doc: Document): string {
  const parser = new DOMParser()
  const parsed = parser.parseFromString(doc.documentElement.outerHTML, 'text/html')

  // Remove all script and style elements
  parsed.querySelectorAll('script, style').forEach((el) => el.remove())

  // Remove style attributes from all elements
  parsed.querySelectorAll('*').forEach((el) => el.removeAttribute('style'))

  // Convert all relative URLs to absolute (src, href, srcset)
  parsed.querySelectorAll('[src], [href]').forEach((element) => {
    ;['src', 'href', 'srcset'].forEach((attr) => {
      const value = element.getAttribute(attr)
      if (!value) return

      if (attr === 'srcset') {
        const newSrcset = value
          .split(',')
          .map((src) => {
            const [url, size] = src.trim().split(' ')
            try {
              const absoluteUrl = new URL(url, doc.baseURI).href
              return `${absoluteUrl}${size ? ' ' + size : ''}`
            } catch {
              return src
            }
          })
          .join(', ')
        element.setAttribute(attr, newSrcset)
      } else if (
        !value.startsWith('http') &&
        !value.startsWith('data:') &&
        !value.startsWith('#') &&
        !value.startsWith('//')
      ) {
        try {
          const absoluteUrl = new URL(value, doc.baseURI).href
          element.setAttribute(attr, absoluteUrl)
        } catch {
          // leave as-is
        }
      }
    })
  })

  return parsed.documentElement.outerHTML
}

// ---------------------------------------------------------------------------
// Page extraction — aligned with obsidian-clipper's pattern:
//   1. Instantiate Defuddle directly
//   2. Try parseAsync() with 8s timeout, fallback to parse()
//   3. Convert content to Markdown using createMarkdownContent()
// ---------------------------------------------------------------------------

export async function extractPage(
  doc: Document,
  url: string,
): Promise<ExtractedPageData> {
  // Try parseAsync first (for async extractors like YouTube transcript)
  // If it hangs, fall back to sync parse (obsidian-clipper pattern)
  const defuddle = new Defuddle(doc, { url })
  const asyncTimeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('parseAsync timeout')), 8000),
  )

  let result
  try {
    result = await Promise.race([defuddle.parseAsync(), asyncTimeout])
  } catch {
    // parseAsync timed out or threw — try sync parse
    try {
      result = defuddle.parse()
    } catch {
      return fallbackExtract(doc, url)
    }
  }

  const content = result.content || ''
  if (!content || content.trim().length === 0) {
    return fallbackExtract(doc, url)
  }

  // Convert HTML content to Markdown (obsidian-clipper pattern)
  const markdown = createMarkdownContent(content, url)

  const contentHash = await computeHash(markdown)
  const wordCount = countWords(markdown)
  const tokenCount = estimateTokens(markdown)

  return {
    url,
    title: result.title || '',
    markdown,
    siteName: result.site || undefined,
    author: result.author || undefined,
    description: result.description || undefined,
    publishedAt: result.published || undefined,
    canonicalUrl: undefined,
    contentHash,
    wordCount,
    tokenCount,
    extractionMethod: 'defuddle',
  }
}

// ---------------------------------------------------------------------------
// RSS-body extraction — convert feed-provided HTML straight to Markdown. Used
// by feed collection so we don't re-fetch the article (often paywalled /
// bot-blocked / JS-rendered) when the feed already carries the full body.
// Metadata comes from the feed item, which is more reliable than what defuddle
// can recover from a fetched page.
// ---------------------------------------------------------------------------

export async function extractFromHtml(
  html: string,
  url: string,
  meta: { title?: string; siteName?: string; author?: string; description?: string; publishedAt?: string } = {},
): Promise<ExtractedPageData> {
  const markdown = createMarkdownContent(html, url)
  const contentHash = await computeHash(markdown)
  const wordCount = countWords(markdown)
  const tokenCount = estimateTokens(markdown)
  return {
    url,
    title: meta.title || '',
    markdown,
    siteName: meta.siteName,
    author: meta.author,
    description: meta.description,
    publishedAt: meta.publishedAt,
    canonicalUrl: undefined,
    contentHash,
    wordCount,
    tokenCount,
    extractionMethod: 'rss',
  }
}

// ---------------------------------------------------------------------------
// Fallback extraction — when defuddle returns empty content
// ---------------------------------------------------------------------------

function fallbackExtract(doc: Document, url: string): Promise<ExtractedPageData> {
  const title = doc.title || ''
  const rawText = (doc.body?.innerText || '').replace(/\n{3,}/g, '\n\n').trim()
  const markdown = title ? `# ${title}\n\n${rawText}` : rawText

  return computeHash(markdown).then((contentHash) => {
    const wordCount = countWords(markdown)
    const tokenCount = estimateTokens(markdown)

    return {
      url,
      title,
      markdown,
      siteName: undefined,
      author: undefined,
      description: undefined,
      publishedAt: undefined,
      canonicalUrl: undefined,
      contentHash,
      wordCount,
      tokenCount,
      extractionMethod: 'fallback',
    }
  })
}
