/**
 * innerText Extractor — Final Fallback Tier
 *
 * Strips all tags and returns plain text when both Defuddle and Readability
 * fail.  This is the lowest-fidelity tier but guarantees something is
 * extracted from every page.
 *
 * Also strips <script>, <style>, <nav>, <footer>, <header>, <aside>
 * before extracting text to reduce noise.
 */

import type { ExtractedContext } from '../types';

// Elements to completely remove before extraction
const REMOVE_SELECTOR = 'script, style, nav, footer, header, aside, noscript, iframe, [aria-hidden="true"], [hidden]';

export function extractWithInnerText(doc: Document): ExtractedContext {
  const startTime = performance.now();

  const clone = doc.cloneNode(true) as Document;

  // Strip noisy elements
  clone.querySelectorAll(REMOVE_SELECTOR).forEach((el) => el.remove());

  const body = clone.body;
  const rawText = body?.innerText || body?.textContent || '';

  // Collapse whitespace (multiple newlines → max 2)
  const collapsed = rawText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim();

  const parseTime = performance.now() - startTime;

  return {
    content: collapsed,
    markdown: collapsed, // No HTML to convert, use as-is
    fullHtml: doc.documentElement.outerHTML,
    metadata: {
      title: doc.title,
      author: '',
      description: collapsed.slice(0, 200),
      published: '',
      site: new URL(doc.URL).hostname,
      domain: new URL(doc.URL).hostname,
      favicon: '',
      image: '',
      url: doc.URL,
      wordCount: collapsed.split(/\s+/).length,
      language: doc.documentElement.lang || '',
      metaTags: extractMetaTags(doc),
    },
    extractorType: 'innertext',
    parseTime,
  };
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
