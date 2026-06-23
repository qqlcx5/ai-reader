/**
 * M2 — Readability extraction engine
 *
 * Uses @mozilla/readability to parse the DOM and turndown to convert
 * the resulting HTML fragment to clean Markdown.
 *
 * Returns null when the extracted content is empty or below the minimum
 * length threshold (confidence = 'low').
 */
import { Readability } from '@mozilla/readability';
import TurndownService from 'turndown';
import type { ExtractionResult, ConfidenceLevel, PageMetadata } from './types';

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
});

function estimateWordCount(text: string): number {
  const cn = (text.match(/[\u4e00-\u9fa5]/g) ?? []).length;
  const en = (text.match(/\b[a-zA-Z]+\b/g) ?? []).length;
  return cn + en;
}

function calcConfidence(markdown: string): ConfidenceLevel {
  if (markdown.length < 200) return 'low';
  if (markdown.length < 1000) return 'medium';
  return 'high';
}

export function runReadabilityEngine(doc: Document): ExtractionResult | null {
  try {
    const clone = doc.cloneNode(true) as Document;
    const reader = new Readability(clone);
    const result = reader.parse();

    if (!result?.content) return null;

    const markdown = turndown.turndown(result.content);
    // Return null when content is below threshold — triggers fallback
    if (!markdown || markdown.length < 200) return null;

    const wordCount = estimateWordCount(markdown);
    const confidence = calcConfidence(markdown);

    const metadata: PageMetadata = {
      title: result.title || doc.title || '',
      author: result.byline || undefined,
      description: result.excerpt || undefined,
      published: result.publishedTime || undefined,
      site: result.siteName || undefined,
      domain: (doc.location as Location | undefined)?.hostname ?? '',
      words: wordCount,
    };

    return {
      markdown,
      engine: 'readability',
      wordCount,
      confidence,
      rawText: markdown,
      metadata,
    };
  } catch (err) {
    console.error('[M2/readability] Extraction failed:', err);
    return null;
  }
}
