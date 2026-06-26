// ============================================================
// PageMind — Content Extraction Pipeline
// ============================================================
// Orchestrates the full extraction flow:
//   1. Flatten Shadow DOM
//   2. Strip ad elements from DOM
//   3. defuddle parse (async, 8s timeout → sync fallback)
//   4. Markdown generation via createMarkdownContent
//   5. Merge metadata from defuddle + custom extractMetadata
//
// On any fatal error, falls back to document.body.innerText.

import type { ExtractResult } from '@/domain'
import type { DefuddleResponse } from 'defuddle'
import { flattenShadowDom } from '@/utils/shadow-dom'
import { extractMetadata, estimateReadingTime } from '@/utils/metadata-extractor'

// ============================================================
// Ad stripping selectors — remove common ad containers
// ============================================================
const AD_SELECTORS = [
  '[class*="ad-"]', '[class*="_ad"]', '[class*="ads-"]',
  '[id*="google_ads"]', '[id*="banner"]',
  '[data-ad]', '[data-advertisement]',
  'ins.adsbygoogle',
  'iframe[src*="doubleclick"]', 'iframe[src*="googlesyndication"]',
  'script', 'style', 'noscript',
]

const PROTECTED_SELECTORS = ['article', 'main', '[role="main"]']

/**
 * Remove common ad elements from a Document before content extraction.
 *
 * Safety constraints:
 * - Only removes leaf nodes or obvious ad containers.
 * - Does NOT touch elements inside <article>, <main>, or [role="main"].
 * - Preserves elements with text length > 100 within protected containers.
 * - Removes empty <p> and whitespace-only <p>.
 */
export function stripAds(doc: Document): void {
  const protectedRoots = new Set<Element>()
  for (const sel of PROTECTED_SELECTORS) {
    doc.querySelectorAll(sel).forEach((el) => protectedRoots.add(el))
  }

  const isProtected = (el: Element): boolean => {
    for (const root of protectedRoots) {
      if (root.contains(el)) {
        // Inside protected container — only remove if text is short (likely ad)
        if ((el.textContent?.length ?? 0) > 100) return true
      }
    }
    return false
  }

  for (const selector of AD_SELECTORS) {
    try {
      const elements = doc.querySelectorAll(selector)
      elements.forEach((el) => {
        if (!isProtected(el)) {
          el.remove()
        }
      })
    } catch {
      // Invalid CSS selector — skip
    }
  }

  // Remove empty <p> and whitespace-only <p> (including &nbsp;)
  const paragraphs = doc.querySelectorAll('p')
  paragraphs.forEach((p) => {
    const text = p.textContent?.trim() ?? ''
    if (text === '' || text === '\u00A0') {
      p.remove()
    }
  })
}

// Extend ExtractResult with markdown field used by content script response
export interface ExtractResponse extends ExtractResult {
  markdown: string
}

/**
 * Full content extraction pipeline.
 *
 * Returns an {@link ExtractResponse} with both the structured metadata
 * and a Markdown representation of the page body.
 *
 * If defuddle fails entirely, the result falls back to plain text
 * from `document.body.innerText`.
 */
export async function extractContent(
  doc: Document,
  url: string,
): Promise<ExtractResponse> {
  // 1. Flatten shadow DOM so defuddle can see Web Component content
  await flattenShadowDom(doc)

  // 2. Strip ad elements before extraction
  stripAds(doc)

  // 3. Extract via defuddle (async first, sync fallback)
  try {
    const { default: Defuddle } = await import('defuddle')
    const { createMarkdownContent } = await import('defuddle/full')

    const defuddle = new Defuddle(doc, { url })

    const TIMEOUT_MS = 8_000
    let rawResult: DefuddleResponse
    try {
      rawResult = await Promise.race([
        defuddle.parseAsync(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('defuddle parseAsync timed out')), TIMEOUT_MS),
        ),
      ])
    } catch {
      // Timeout or async failure → synchronous fallback
      rawResult = defuddle.parse()
    }

    const markdown = createMarkdownContent(rawResult.content, url)
    const meta = extractMetadata(doc, url)

    const contentText = rawResult.content || ''

    return {
      title: rawResult.title || meta.title,
      url,
      siteName: rawResult.site || rawResult.domain || meta.siteName,
      author: rawResult.author || meta.author,
      publishedAt: rawResult.published || meta.publishedAt,
      excerpt: rawResult.description || meta.description,
      contentHtml: rawResult.content || undefined,
      contentText: contentText || undefined,
      image: rawResult.image || undefined,
      readingTime: rawResult.wordCount
        ? Math.max(1, Math.ceil(rawResult.wordCount / 200))
        : estimateReadingTime(contentText),
      markdown,
    }
  } catch (err) {
    console.error('[PageMind] defuddle extraction failed, falling back to plain text:', err)

    // Fallback: extract raw text from body
    const plainText = doc.body?.innerText?.trim() || ''
    const meta = extractMetadata(doc, url)

    return {
      title: meta.title || doc.title || '',
      url,
      siteName: meta.siteName,
      author: meta.author,
      publishedAt: meta.publishedAt,
      excerpt: meta.description,
      contentText: plainText || undefined,
      readingTime: estimateReadingTime(plainText),
      markdown: plainText ? `# ${meta.title || ''}\n\n${plainText}` : '',
    }
  }
}
