/**
 * M2 — Main extraction entry with 3-level fallback
 * Readability → Defuddle → innerText
 */
import type { ExtractedContext, ExtractOptions } from './types';
import { extractWithReadability } from './extractors/readability';
import { extractWithDefuddle } from './extractors/defuddle';
import { extractWithInnerText } from './extractors/innerText';
import { MIN_CONTENT_LENGTH, DEFAULT_DEFUDDLE_TIMEOUT } from './types';

export async function extractPage(
  doc: Document,
  options: ExtractOptions = {}
): Promise<ExtractedContext> {
  const minLen = options.minContentLength ?? MIN_CONTENT_LENGTH;
  const timeout = options.defuddleTimeoutMs ?? DEFAULT_DEFUDDLE_TIMEOUT;
  const preferredFormat = options.preferredFormat ?? 'markdown';

  // Level 1: Readability
  const readability = extractWithReadability(doc);
  if (readability && readability.content.length >= minLen) {
    return readability;
  }

  // Level 2: Defuddle
  const defuddle = await extractWithDefuddle(doc, timeout);
  if (defuddle && defuddle.content.length >= minLen) {
    return defuddle;
  }

  // Level 3: innerText fallback
  const innerText = extractWithInnerText(doc);
  if (innerText.content.length >= minLen) {
    return innerText;
  }

  // If even innerText is too short, still return it (better than nothing)
  return innerText;
}

/**
 * Synchronous check if DOM is ready for extraction.
 */
export function isDomReady(doc: Document): boolean {
  return doc.readyState === 'complete' || doc.readyState === 'interactive';
}

/**
 * Wait for DOMContentLoaded if not ready.
 */
export function waitForDomReady(doc: Document): Promise<void> {
  return new Promise((resolve) => {
    if (isDomReady(doc)) {
      resolve();
      return;
    }
    const handler = () => {
      doc.removeEventListener('DOMContentLoaded', handler);
      resolve();
    };
    doc.addEventListener('DOMContentLoaded', handler);
  });
}
