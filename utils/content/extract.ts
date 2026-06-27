import DOMPurify from 'dompurify'
import Defuddle from 'defuddle'

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

export async function computeHash(text: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(text)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function stripHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  return doc.body.textContent || ''
}

export interface DefuddleLikeResult {
  title?: string
  site?: string
  author?: string
  description?: string
  published?: string
  content?: string
  contentMarkdown?: string
}

export type DefuddleLikeConstructor = new (
  doc: Document,
  options?: { url?: string; markdown?: boolean; separateMarkdown?: boolean },
) => { parse(): DefuddleLikeResult }

export function extractPage(
  doc: Document,
  url: string,
  DefuddleCtor: DefuddleLikeConstructor,
): Promise<ExtractedPageData> {
  return new Promise((resolve) => {
    try {
      const parser = new DefuddleCtor(doc, {
        url,
        markdown: true,
        separateMarkdown: true,
      })
      const result = parser.parse()
      const markdown = result.contentMarkdown || ''

      if (!markdown || markdown.trim().length === 0) {
        resolve(fallbackExtract(doc, url))
        return
      }

      computeHash(markdown).then((contentHash) => {
        const wordCount = markdown.split(/\s+/).filter(Boolean).length
        const tokenCount = Math.ceil(markdown.length / 4)

        resolve({
          url,
          title: result.title || '',
          markdown,
          rawText: result.content ? stripHtml(result.content) : '',
          siteName: result.site || undefined,
          author: result.author || undefined,
          description: result.description || undefined,
          publishedAt: result.published || undefined,
          canonicalUrl: undefined,
          contentHash,
          wordCount,
          tokenCount,
          extractionMethod: 'defuddle',
        })
      })
    } catch {
      resolve(fallbackExtract(doc, url))
    }
  })
}

export function fallbackExtract(
  doc: Document,
  url: string,
): Promise<ExtractedPageData> {
  return new Promise((resolve) => {
    const title = doc.title || ''
    const rawText = (doc.body?.innerText || '').replace(/\n{3,}/g, '\n\n').trim()
    const markdown = title ? `# ${title}\n\n${rawText}` : rawText

    computeHash(markdown).then((contentHash) => {
      const wordCount = markdown.split(/\s+/).filter(Boolean).length
      const tokenCount = Math.ceil(markdown.length / 4)

      resolve({
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
      })
    })
  })
}

export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html)
}
