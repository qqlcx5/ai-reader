// ============================================================
// PageMind — Content Extraction Pipeline
// ============================================================
// Orchestrates the full extraction flow:
//   1. Flatten Shadow DOM
//   2. defuddle parse (async, 8s timeout → sync fallback)
//   3. Markdown generation via createMarkdownContent
//   4. Merge metadata from defuddle + custom extractMetadata
//
// On any fatal error, falls back to document.body.innerText.

import type { ExtractResult } from '@/domain'
import type { DefuddleResponse } from 'defuddle'
import { flattenShadowDom } from '@/utils/shadow-dom'
import { extractMetadata, estimateReadingTime } from '@/utils/metadata-extractor'

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

  // 2. Extract via defuddle (async first, sync fallback)
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
