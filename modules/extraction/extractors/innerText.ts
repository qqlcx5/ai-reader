/**
 * M2 — innerText fallback extractor
 * Cleans DOM and extracts plain text.
 */
import type { ExtractedContext } from '../types';

const TAGS_TO_REMOVE = ['script', 'style', 'nav', 'footer', 'aside', 'header', 'noscript', 'iframe'];

function estimateWordCount(text: string): number {
  const cn = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  const en = (text.match(/[a-zA-Z]+/g) || []).length;
  return cn + en;
}

export function extractWithInnerText(doc: Document): ExtractedContext {
  const clone = doc.cloneNode(true) as Document;

  for (const tag of TAGS_TO_REMOVE) {
    const elements = clone.querySelectorAll(tag);
    for (const el of elements) {
      el.remove();
    }
  }

  const body = clone.body;
  let text = body ? body.innerText || body.textContent || '' : '';

  // Clean excessive whitespace
  text = text
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim();

  return {
    url: doc.location?.href || '',
    title: doc.title || '',
    siteName: '',
    extractedAt: Date.now(),
    wordCount: estimateWordCount(text),
    content: text,
    format: 'text',
    extractor: 'innerText',
    htmlFingerprint: text.slice(0, 500).replace(/\s+/g, ' '),
  };
}
