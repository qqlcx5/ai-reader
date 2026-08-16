/**
 * PDF / arXiv clipping.
 *
 * Content scripts cannot run inside Chrome's built-in PDF viewer, so PDFs are
 * fetched and parsed inside the side panel with pdf.js (dynamically imported
 * to keep it out of the main bundle). arXiv URLs prefer the official HTML
 * version of a paper (better structure, no OCR-style layout issues) and fall
 * back to the PDF.
 */
import { extractFromHtml, computeHash, countWords, type ExtractedPageData } from '@/utils/content/extract'
import { estimateTokens } from '@/utils/token'
import type { ExtractionMethod } from '@/types/document'
// Just an asset URL string — the heavy worker itself stays a separate chunk.
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

// ---------------------------------------------------------------------------
// URL detection
// ---------------------------------------------------------------------------

export function isPdfUrl(url: string): boolean {
  try {
    const u = new URL(url)
    return u.protocol.startsWith('http') && u.pathname.toLowerCase().endsWith('.pdf')
  } catch {
    return false
  }
}

const ARXIV_RE = /^https?:\/\/(?:www\.|export\.)?arxiv\.org\/(?:abs|pdf|html)\/(\d{4}\.\d{4,5})(v\d+)?/i

/** '2301.01234' (version-stripped) when the URL points at an arXiv paper. */
export function arxivId(url: string): string | null {
  const m = ARXIV_RE.exec(url)
  return m ? m[1] : null
}

export function arxivHtmlUrl(id: string): string {
  return `https://arxiv.org/html/${id}`
}

export function arxivPdfUrl(id: string): string {
  return `https://arxiv.org/pdf/${id}`
}

// ---------------------------------------------------------------------------
// Layout — pure, testable
// ---------------------------------------------------------------------------

export interface PdfTextItem {
  str: string
  /** Position on the page (PDF coords: y grows upward). */
  x: number
  y: number
  height: number
}

interface Line {
  y: number
  height: number
  text: string
}

function itemsToLines(items: PdfTextItem[]): Line[] {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x)
  const lines: Line[] = []
  let current: { y: number; height: number; parts: { x: number; str: string }[] } | null = null

  for (const item of sorted) {
    const str = item.str
    if (!str.trim() && !current) continue
    if (current && Math.abs(current.y - item.y) <= Math.max(current.height, item.height) * 0.5) {
      current.parts.push({ x: item.x, str })
    } else {
      if (current) lines.push(finishLine(current))
      current = { y: item.y, height: item.height, parts: [{ x: item.x, str }] }
    }
  }
  if (current) lines.push(finishLine(current))
  return lines
}

function finishLine(line: { y: number; height: number; parts: { x: number; str: string }[] }): Line {
  const parts = [...line.parts].sort((a, b) => a.x - b.x)
  let text = ''
  let prevEnd: number | null = null
  for (const part of parts) {
    if (prevEnd != null && part.x - prevEnd > line.height * 0.3 && !text.endsWith(' ') && !part.str.startsWith(' ')) {
      text += ' '
    }
    text += part.str
    prevEnd = part.x + part.str.length * line.height * 0.5
  }
  return { y: line.y, height: line.height, text: text.replace(/\s+/g, ' ').trim() }
}

/** Standalone 1–4 digit lines are almost always page numbers / footers. */
function isPageNumberLine(text: string): boolean {
  return /^\d{1,4}$/.test(text)
}

/** Convert per-page text items (top of page first) into readable Markdown. */
export function pdfPagesToMarkdown(pages: PdfTextItem[][]): string {
  const pageTexts = pages.map((items) => {
    const lines = itemsToLines(items).filter((l) => l.text && !isPageNumberLine(l.text))
    let text = ''
    let prev: Line | null = null
    for (const line of lines) {
      if (prev) {
        const gap = prev.y - line.y
        text += gap > (prev.height + line.height) / 2 * 1.7 ? '\n\n' : '\n'
      }
      text += line.text
      prev = line
    }
    return text.trim()
  })
  return pageTexts.filter(Boolean).join('\n\n---\n\n')
}

// ---------------------------------------------------------------------------
// Extraction
// ---------------------------------------------------------------------------

type PdfjsModule = typeof import('pdfjs-dist')

let pdfjsPromise: Promise<PdfjsModule> | null = null

async function loadPdfjs(): Promise<PdfjsModule> {
  if (!pdfjsPromise) {
    pdfjsPromise = import('pdfjs-dist').then((pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
      return pdfjs
    })
  }
  return pdfjsPromise
}

function filenameFromUrl(url: string): string {
  try {
    const name = decodeURIComponent(new URL(url).pathname.split('/').pop() || '')
    return name.replace(/\.pdf$/i, '')
  } catch {
    return 'Untitled PDF'
  }
}

/** Extract the text of a PDF at `url` as an ExtractedPageData. */
export async function extractPdfFromUrl(url: string, signal?: AbortSignal): Promise<ExtractedPageData> {
  const response = await fetch(url, { signal })
  if (!response.ok) throw new Error(`PDF 下载失败：HTTP ${response.status}`)
  const data = new Uint8Array(await response.arrayBuffer())

  const pdfjs = await loadPdfjs()
  const loadingTask = pdfjs.getDocument({ data })
  const pdf = await loadingTask.promise
  try {
    const pages: PdfTextItem[][] = []
    const max = Math.min(pdf.numPages, 200)
    for (let i = 1; i <= max; i++) {
      const page = await pdf.getPage(i)
      const content = await page.getTextContent()
      pages.push(
        (content.items as unknown[])
          .filter((it): it is { str: string; transform: number[]; height?: number } =>
            typeof (it as any)?.str === 'string')
          .map((it) => ({ str: it.str, x: it.transform[4], y: it.transform[5], height: it.height || 10 })),
      )
    }

    const markdown = pdfPagesToMarkdown(pages)
    if (!markdown.trim()) throw new Error('PDF 中没有可提取的文本（可能是扫描件）')

    // Title: metadata → first line → filename
    let title = ''
    try {
      const meta = await pdf.getMetadata()
      title = String((meta.info as any)?.Title || '').trim()
    } catch { /* metadata is optional */ }
    if (!title) {
      const firstLine = markdown.split('\n')[0]?.trim() || ''
      title = firstLine.length > 0 && firstLine.length <= 200 ? firstLine : filenameFromUrl(url)
    }

    return finalize(url, title, markdown, 'pdf')
  } finally {
    await loadingTask.destroy()
  }
}

/**
 * Clip an arXiv paper: prefer the official HTML version, fall back to PDF.
 * `url` can be an /abs, /pdf or /html link.
 */
export async function extractArxivFromUrl(url: string, signal?: AbortSignal): Promise<ExtractedPageData> {
  const id = arxivId(url)
  if (!id) throw new Error('不是有效的 arXiv 链接')

  const htmlResp = await fetch(arxivHtmlUrl(id), { signal }).catch(() => null)
  if (htmlResp?.ok) {
    const html = await htmlResp.text()
    if (html.includes('article')) {
      const data = await extractFromHtml(html, url, { siteName: 'arXiv' })
      if (data.markdown.replace(/\W/g, '').length > 500) {
        return { ...data, url, title: data.title || `arXiv:${id}`, extractionMethod: 'pdf' }
      }
    }
  }

  return extractPdfFromUrl(arxivPdfUrl(id), signal)
}

async function finalize(url: string, title: string, markdown: string, method: ExtractionMethod): Promise<ExtractedPageData> {
  const contentHash = await computeHash(markdown)
  return {
    url,
    title,
    markdown,
    siteName: arxivId(url) ? 'arXiv' : undefined,
    contentHash,
    wordCount: countWords(markdown),
    tokenCount: estimateTokens(markdown),
    extractionMethod: method,
  }
}
