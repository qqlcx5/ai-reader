// ============================================================
// defuddle Adapter for SuperBrain Content Extraction
// ============================================================

import type { ExtractResult } from '../../shared/domain';
import { flattenShadowDom } from './shadow-dom';

const EXTRACTION_TIMEOUT_MS = 8000;

interface DefuddleModule {
  default: new (doc: Document, options: { url: string }) => DefuddleInstance;
}

interface DefuddleInstance {
  parseAsync(): Promise<DefuddleContent>;
  parse(): DefuddleContent;
}

interface DefuddleContent {
  title: string;
  content: string;
  contentHtml?: string;
  contentText?: string;
  textContent?: string;
  excerpt?: string;
  author?: string;
  siteName?: string;
  publishedAt?: string;
  image?: string;
  readingTime?: number;
  url?: string;
}

/**
 * Extracts content from a web page using defuddle.
 *
 * Flow:
 * 1. Flatten shadow DOM for Web Component support
 * 2. Try defuddle.parseAsync() with an 8-second timeout
 * 3. Fall back to synchronous defuddle.parse() on timeout or error
 * 4. Return a normalized ExtractResult
 *
 * @param document - The page's Document object
 * @param url - The page URL (for defuddle context)
 * @returns Normalized ExtractResult
 */
export async function extractContent(
  document: Document,
  url: string,
): Promise<ExtractResult> {
  // 1. Flatten shadow DOM to expose Web Component content
  flattenShadowDom(document);

  // 2. Dynamically import defuddle (keeps content script lean)
  const DefuddleModule = (await import('defuddle')) as DefuddleModule;
  const Defuddle = DefuddleModule.default;

  const defuddle = new Defuddle(document, { url });

  // 3. Try async extraction with a timeout
  let raw: DefuddleContent;
  try {
    raw = await Promise.race([
      defuddle.parseAsync(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('defuddle async timeout')), EXTRACTION_TIMEOUT_MS),
      ),
    ]);
  } catch {
    // Fall back to synchronous extraction
    raw = defuddle.parse();
  }

  // 4. Normalize to ExtractResult
  return normalize(raw, url);
}

/**
 * Normalizes defuddle's output to the ExtractResult type expected by the rest
 * of the system. Handles field name differences between defuddle versions.
 */
function normalize(raw: DefuddleContent, url: string): ExtractResult {
  const contentHtml = raw.contentHtml ?? raw.content ?? '';
  const contentText =
    raw.contentText ?? raw.textContent ?? stripHtml(contentHtml);

  return {
    title: raw.title ?? '',
    url: raw.url ?? url,
    siteName: raw.siteName ?? '',
    author: raw.author ?? '',
    publishedAt: raw.publishedAt ?? '',
    excerpt: raw.excerpt ?? contentText.slice(0, 280).trim(),
    contentHtml,
    contentText,
    image: raw.image ?? '',
    readingTime: raw.readingTime ?? estimateReadingTime(contentText),
  };
}

function stripHtml(html: string): string {
  // Simple html-to-text fallback (content script – keep it light)
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function estimateReadingTime(text: string): number {
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}
