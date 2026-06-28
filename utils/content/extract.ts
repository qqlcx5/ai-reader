import Defuddle from 'defuddle'
import { createMarkdownContent } from 'defuddle/full'

// ---------------------------------------------------------------------------
// Types — matches the AuraMind internal data model
// ---------------------------------------------------------------------------

export interface ExtractedPageData {
  url: string
  title: string
  markdown: string
  rawText: string
  siteName?: string
  author?: string
  description?: string
  publishedAt?: string
  canonicalUrl?: string
  contentHash: string
  wordCount: number
  tokenCount: number
  extractionMethod: 'defuddle' | 'fallback'
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
// HTML to plain text — preserve paragraph structure (newlines from block elements)
// ---------------------------------------------------------------------------

const BLOCK_RE = /<\/(?:div|p|h[1-6]|li|blockquote|pre|table|tr|section|article|header|footer|nav|main|aside|figure|figcaption|details|summary|fieldset|form|hr|ul|ol|dl|dt|dd|address|br)[^>]*>/gi

export function htmlToPlainText(html: string): string {
  return html
    // Self-closing br
    .replace(/<br\s*\/?>/gi, '\n')
    // Closing tags of block elements → newline
    .replace(BLOCK_RE, '\n')
    // Strip all remaining HTML tags
    .replace(/<[^>]+>/g, '')
    // Decode common HTML entities
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    // Collapse horizontal whitespace (spaces/tabs) on each line, keep newlines
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    // Collapse 3+ consecutive newlines to 2 (i.e. at most one blank line between paragraphs)
    .replace(/\n{3,}/g, '\n\n')
    .trim()
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
  const wordCount = markdown.split(/\s+/).filter(Boolean).length
  const tokenCount = Math.ceil(markdown.length / 4)

  return {
    url,
    title: result.title || '',
    markdown,
    rawText: htmlToPlainText(content),
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
// Fallback extraction — when defuddle returns empty content
// ---------------------------------------------------------------------------

function fallbackExtract(doc: Document, url: string): Promise<ExtractedPageData> {
  const title = doc.title || ''
  const rawText = (doc.body?.innerText || '').replace(/\n{3,}/g, '\n\n').trim()
  const markdown = title ? `# ${title}\n\n${rawText}` : rawText

  return computeHash(markdown).then((contentHash) => {
    const wordCount = markdown.split(/\s+/).filter(Boolean).length
    const tokenCount = Math.ceil(markdown.length / 4)

    return {
      url,
      title,
      markdown,
      rawText,
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
