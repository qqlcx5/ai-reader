/**
 * Defuddle Extractor — Primary Tier
 *
 * Uses the defuddle library for semantic content extraction with
 * async variable support (e.g. {{transcript}} for YouTube).
 *
 * Pattern: based on obsidian-clipper's content.ts and clip-utils.ts
 *   new Defuddle(doc, { url }) → parseAsync() → { content, title, ... }
 *
 * Defuddle HTML output is converted to Markdown via createMarkdownContent().
 */

import type { ExtractedContext, ExtractionRequest, ExtractionError } from '../types';
import { contentToMarkdown } from '../markdown';

const DEFUDDLE_TIMEOUT_MS = 8000;

// ─── Public API ──────────────────────────────────────────────────────

/**
 * Extract page content using Defuddle.
 *
 * Must be called from the content script context where `document` is available.
 * On failure, returns the error so the orchestrator can fall through to
 * the next tier.
 */
export async function extractWithDefuddle(
  doc: Document,
  req: ExtractionRequest,
): Promise<ExtractedContext> {
  const startTime = performance.now();

  // Dynamic import so the bundler can code-split defuddle
  // In content script context, we can also use a global Defuddle
  const Defuddle = getDefuddle();

  const defuddle = new Defuddle(doc, { url: doc.URL });

  // parseAsync supports async variables (e.g. YouTube transcripts)
  // Timeout after DEFUDDLE_TIMEOUT_MS in case a third-party extension
  // has corrupted the fetch API and parseAsync would hang forever.
  const parseTimeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Defuddle parseAsync timed out')), DEFUDDLE_TIMEOUT_MS),
  );

  let result: {
    content: string;
    title: string;
    author: string;
    description: string;
    published: string;
    domain: string;
    favicon: string;
    image: string;
    wordCount: number;
    parseTime: number;
    language: string;
    variables?: Record<string, string>;
  };

  try {
    result = await Promise.race([defuddle.parseAsync(), parseTimeout]);
  } catch {
    // Fallback to sync parse
    result = defuddle.parse();
  }

  const parseTime = performance.now() - startTime;
  const markdown = contentToMarkdown(result.content, doc.URL);

  return {
    content: result.content,
    markdown,
    fullHtml: doc.documentElement.outerHTML,
    metadata: {
      title: result.title,
      author: result.author,
      description: result.description,
      published: result.published,
      site: result.title || doc.title,
      domain: result.domain,
      favicon: result.favicon,
      image: result.image,
      url: doc.URL,
      wordCount: result.wordCount,
      language: result.language || '',
      metaTags: extractMetaTags(doc),
    },
    extractorType: 'defuddle',
    parseTime,
  };
}

// ─── Helper ──────────────────────────────────────────────────────────

/**
 * Get Defuddle constructor, preferring global (content script injection)
 * over dynamic import (for bundler code-splitting).
 */
function getDefuddle(): any {
  const g = globalThis as any;
  if (g.Defuddle) return g.Defuddle;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  try { return require('defuddle'); } catch {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('defuddle/full');
  }
}

/**
 * Extract meta tags from the document head for variable templates.
 */
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
