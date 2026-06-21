/**
 * Readability Extractor — Secondary Tier (fallback)
 *
 * Uses Mozilla's @mozilla/readability when Defuddle fails.
 * Readability produces clean article HTML with DOM-based extraction.
 *
 * https://github.com/mozilla/readability
 */

import type { ExtractedContext, ExtractionRequest } from '../types';
import { contentToMarkdown } from '../markdown';

const READABILITY_TIMEOUT_MS = 5000;

// ─── Public API ──────────────────────────────────────────────────────

export async function extractWithReadability(
  doc: Document,
  req: ExtractionRequest,
): Promise<ExtractedContext> {
  const startTime = performance.now();

  // Dynamic import so @mozilla/readability can be code-split
  const { Readability } = await importReadability();

  // Readability modifies the document passed to it, so clone first
  const clone = doc.cloneNode(true) as Document;

  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Readability parse timed out')), READABILITY_TIMEOUT_MS),
  );

  const article = await Promise.race([
    Promise.resolve(new Readability(clone).parse()),
    timeout,
  ]);

  if (!article) {
    throw new Error('Readability returned null (no article content found)');
  }

  const parseTime = performance.now() - startTime;
  const markdown = contentToMarkdown(article.content || '', doc.URL);

  return {
    content: article.content || '',
    markdown,
    fullHtml: doc.documentElement.outerHTML,
    metadata: {
      title: article.title || doc.title,
      author: article.byline || '',
      description: article.excerpt || '',
      published: '',
      site: article.siteName || new URL(doc.URL).hostname,
      domain: new URL(doc.URL).hostname,
      favicon: getFavicon(doc),
      image: '',
      url: doc.URL,
      wordCount: article.textContent ? article.textContent.split(/\s+/).length : 0,
      language: doc.documentElement.lang || '',
      metaTags: extractMetaTags(doc),
    },
    extractorType: 'readability',
    parseTime,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────

async function importReadability(): Promise<{
  Readability: new (doc: Document, options?: Record<string, unknown>) => { parse(): { title: string | null | undefined; byline: string | null | undefined; excerpt: string | null | undefined; content: string | null | undefined; textContent: string | null | undefined; siteName?: string | null } | null };
}> {
  try {
    return await import('@mozilla/readability');
  } catch {
    // In a browser extension, Readability might be injected via content script
    const g = globalThis as any;
    if (g.Readability) {
      return { Readability: g.Readability };
    }
    throw new Error('@mozilla/readability not available');
  }
}

function getFavicon(doc: Document): string {
  const link = doc.querySelector<HTMLLinkElement>('link[rel*="icon"]');
  if (link?.href) {
    try {
      return new URL(link.href, doc.URL).href;
    } catch { /* fall through */ }
  }
  return `${new URL(doc.URL).origin}/favicon.ico`;
}

function extractMetaTags(doc: Document): Array<{ name?: string | null; property?: string | null; content: string | null }> {
  const tags: Array<{ name?: string | null; property?: string | null; content: string | null }> = [];
  const metaElements = doc.querySelectorAll<HTMLMetaElement>('meta[name], meta[property]');
  for (const meta of metaElements) {
    tags.push({
      name: meta.getAttribute('name'),
      property: meta.getAttribute('property'),
      content: meta.getAttribute('content'),
    });
  }
  return tags;
}
