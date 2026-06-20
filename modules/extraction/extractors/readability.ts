/**
 * M2 — Readability extractor
 * Uses @mozilla/readability + turndown to produce Markdown.
 */
import { Readability } from '@mozilla/readability';
import TurndownService from 'turndown';
import type { ExtractedContext } from '../types';

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
});

function estimateWordCount(text: string): number {
  // Chinese characters + English words
  const cn = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  const en = (text.match(/[a-zA-Z]+/g) || []).length;
  return cn + en;
}

function generateFingerprint(html: string): string {
  return html.slice(0, 500).replace(/\s+/g, ' ');
}

export function extractWithReadability(doc: Document): ExtractedContext | null {
  try {
    const clone = doc.cloneNode(true) as Document;
    const reader = new Readability(clone);
    const result = reader.parse();

    if (!result || !result.content || result.content.length < 200) {
      return null;
    }

    const markdown = turndown.turndown(result.content);
    if (!markdown || markdown.length < 200) {
      return null;
    }

    return {
      url: doc.location?.href || '',
      title: result.title || doc.title || '',
      siteName: result.siteName || '',
      extractedAt: Date.now(),
      wordCount: estimateWordCount(markdown),
      content: markdown,
      format: 'markdown',
      extractor: 'readability',
      htmlFingerprint: generateFingerprint(result.content),
    };
  } catch (e) {
    console.error('[M2] Readability extraction failed:', e);
    return null;
  }
}
