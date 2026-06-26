// ============================================================
// PageMind — Page Metadata Extractor
// ============================================================
// Extracts structured metadata from a DOM document using
// OG tags, Twitter Cards, JSON-LD, and standard meta elements.

import type { PageMetadata } from '@/domain'

/**
 * Extract page metadata with priority chains:
 *
 *   title:       og:title → twitter:title → document.title
 *   siteName:    og:site_name → hostname
 *   author:      article:author → meta[name=author] → JSON-LD
 *   publishedAt: article:published_time → JSON-LD → <time>
 *   description: og:description → meta[name=description]
 *   faviconUrl:  link[rel*=icon]
 *   lang:        html[lang]
 *   readingTime: estimated from word count (300 chars/min CJK, 200 words/min Latin)
 */
export function extractMetadata(doc: Document, url: string): PageMetadata {
  const hostname = safeHostname(url)

  return {
    title: extractTitle(doc) || hostname || '',
    url,
    siteName: extractSiteName(doc) || hostname,
    author: extractAuthor(doc),
    publishedAt: extractPublishedAt(doc),
    description: extractDescription(doc),
    faviconUrl: extractFavicon(doc),
    lang: doc.documentElement.lang || undefined,
  }
}

/**
 * Estimate reading time in minutes from a block of text.
 * Chinese/Japanese/Korean characters are counted at 300/min;
 * all other words (split on whitespace) at 200/min.
 */
export function estimateReadingTime(text: string): number {
  const cjkChars = (text.match(/[一-鿿぀-ゟ゠-ヿ]/g) || []).length
  const latinWords = text
    .replace(/[一-鿿぀-ゟ゠-ヿ]/g, '')
    .split(/\s+/)
    .filter(Boolean).length

  const minutes = cjkChars / 300 + latinWords / 200
  return Math.max(1, Math.round(minutes))
}

// ---- Internal Helpers ----

function safeHostname(url: string): string | undefined {
  try { return new URL(url).hostname } catch { return undefined }
}

function getMeta(doc: Document, attr: string, value: string): string | undefined {
  const el = doc.querySelector(`meta[${attr}="${value}"]`)
  return el?.getAttribute('content')?.trim() || undefined
}

// --- Title ---

function extractTitle(doc: Document): string | undefined {
  return (
    getMeta(doc, 'property', 'og:title') ||
    getMeta(doc, 'name', 'twitter:title') ||
    doc.title?.trim() ||
    undefined
  )
}

// --- Site Name ---

function extractSiteName(doc: Document): string | undefined {
  return getMeta(doc, 'property', 'og:site_name')
}

// --- Author ---

function extractAuthor(doc: Document): string | undefined {
  // 1. article:author (common in news / blog platforms)
  const articleAuthor =
    getMeta(doc, 'property', 'article:author') ||
    getMeta(doc, 'name', 'article:author')
  if (articleAuthor) return articleAuthor

  // 2. Standard meta author
  const metaAuthor = getMeta(doc, 'name', 'author')
  if (metaAuthor) return metaAuthor

  // 3. JSON-LD (first valid @type: Person or author string)
  const jsonLdAuthor = extractJsonLdAuthor(doc)
  if (jsonLdAuthor) return jsonLdAuthor

  return undefined
}

function extractJsonLdAuthor(doc: Document): string | undefined {
  const scripts = doc.querySelectorAll('script[type="application/ld+json"]')

  for (const script of scripts) {
    try {
      const data = JSON.parse(script.textContent || '')

      // Handle both single object and @graph array
      const items = Array.isArray(data) ? data
        : data['@graph'] ? data['@graph']
          : [data]

      for (const item of items) {
        if (!item || typeof item !== 'object') continue

        const author = item.author
        if (!author) continue

        if (typeof author === 'string') return author
        if (typeof author === 'object' && author.name) return author.name

        // Array of authors
        if (Array.isArray(author) && author.length > 0) {
          const first = author[0]
          if (typeof first === 'string') return first
          if (typeof first === 'object' && first.name) return first.name
        }
      }
    } catch {
      // Malformed JSON-LD, skip
    }
  }

  return undefined
}

// --- Published Date ---

function extractPublishedAt(doc: Document): string | undefined {
  // 1. article:published_time
  const articleTime = getMeta(doc, 'property', 'article:published_time')
  if (articleTime) return articleTime

  // 2. JSON-LD
  const jsonLdDate = extractJsonLdDate(doc)
  if (jsonLdDate) return jsonLdDate

  // 3. <time> elements with datetime attribute
  const timeEl = doc.querySelector('time[datetime]')
  if (timeEl) {
    const dt = timeEl.getAttribute('datetime')
    if (dt) return dt
  }

  return undefined
}

function extractJsonLdDate(doc: Document): string | undefined {
  const scripts = doc.querySelectorAll('script[type="application/ld+json"]')

  for (const script of scripts) {
    try {
      const data = JSON.parse(script.textContent || '')
      const items = Array.isArray(data) ? data
        : data['@graph'] ? data['@graph']
          : [data]

      for (const item of items) {
        if (!item || typeof item !== 'object') continue
        const date =
          item.datePublished ||
          item.dateCreated ||
          item.dateModified
        if (typeof date === 'string' && date) return date
      }
    } catch {
      // Malformed JSON-LD, skip
    }
  }

  return undefined
}

// --- Description ---

function extractDescription(doc: Document): string | undefined {
  return (
    getMeta(doc, 'property', 'og:description') ||
    getMeta(doc, 'name', 'description') ||
    undefined
  )
}

// --- Favicon ---

function extractFavicon(doc: Document): string | undefined {
  const el = doc.querySelector('link[rel*="icon"]')
  return el?.getAttribute('href')?.trim() || undefined
}
