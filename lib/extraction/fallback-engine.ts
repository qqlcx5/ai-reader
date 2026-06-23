/**
 * M2 — Fallback innerText extraction engine
 *
 * Strips <script>, <style>, <noscript> and other noise nodes from a clone of
 * the document, then reads document.body.innerText (or textContent in
 * environments where innerText is unavailable). Excessive blank lines and
 * leading/trailing whitespace are normalised.
 *
 * Always returns a result (confidence = 'low') — this is the final safety net.
 */
import type { ExtractionResult, PageMetadata } from './types';

const TAGS_TO_STRIP = [
  'script',
  'style',
  'noscript',
  'iframe',
  'svg',
  'canvas',
  'template',
] as const;

function estimateWordCount(text: string): number {
  const cn = (text.match(/[\u4e00-\u9fa5]/g) ?? []).length;
  const en = (text.match(/\b[a-zA-Z]+\b/g) ?? []).length;
  return cn + en;
}

export function runFallbackEngine(doc: Document): ExtractionResult {
  const clone = doc.cloneNode(true) as Document;

  for (const tag of TAGS_TO_STRIP) {
    clone.querySelectorAll(tag).forEach((el) => el.remove());
  }

  const body = clone.body;
  let text: string = body
    ? ((body as any).innerText as string | undefined) ?? body.textContent ?? ''
    : '';

  // Normalise excessive whitespace
  text = text
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();

  const wordCount = estimateWordCount(text);

  const metadata: PageMetadata = {
    title: doc.title || '',
    domain: (doc.location as Location | undefined)?.hostname ?? '',
    words: wordCount,
  };

  return {
    markdown: text,
    engine: 'fallback',
    wordCount,
    confidence: 'low',
    rawText: text,
    metadata,
  };
}
