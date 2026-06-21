/**
 * Content Script Entry Point
 *
 * Injected into the target page via chrome.scripting.executeScript.
 * Listens for extraction requests from the background script and returns
 * structured content via chrome.runtime.sendMessage.
 *
 * Based on design-02-extraction.md §7 and obsidian-clipper's content.ts pattern.
 */

import type { ExtractedContext, ExtractionRequest, ExtractionResponse } from './types';
import { extract } from './extractors/index';

// ─── Constants ───────────────────────────────────────────────────────

/** Minimum content length to consider extraction successful */
const MIN_CONTENT_LENGTH = 200;

/** Maximum time to wait for DOM readiness */
const DOM_READY_TIMEOUT_MS = 5000;

// ─── Message Handler ─────────────────────────────────────────────────

/**
 * Listen for extraction requests from the background script.
 *
 * Message format:
 *   { action: "extractPage", url?: string, forceRefresh?: boolean }
 */
chrome.runtime.onMessage.addListener(
  (message: ExtractionRequest & { action: string }, _sender, sendResponse) => {
    if (message.action !== 'extractPage') return false; // Not for us

    handleExtractRequest(message).then(sendResponse).catch((err) => {
      sendResponse({
        success: false,
        error: {
          code: 'ALL_TIERS_FAILED',
          message: err instanceof Error ? err.message : String(err),
          tier: 'innertext',
        },
      } satisfies ExtractionResponse);
    });

    return true; // Keep the message channel open for async response
  },
);

// ─── Extraction Request Handler ──────────────────────────────────────

async function handleExtractRequest(
  req: ExtractionRequest,
): Promise<ExtractionResponse> {
  try {
    // Ensure DOM is ready before extraction
    await ensureDomReady();

    const context = await extract(document, req);

    // Validate minimum content
    if (!context.content || context.content.trim().length < MIN_CONTENT_LENGTH) {
      return {
        success: false,
        error: {
          code: 'ALL_TIERS_FAILED',
          message: `Extracted content too short (${context.content?.length ?? 0} chars, minimum ${MIN_CONTENT_LENGTH})`,
          tier: context.extractorType,
        },
      };
    }

    // Extract Schema.org structured data
    const schemaOrgData = extractSchemaOrgData(document);
    if (schemaOrgData) {
      context.metadata.metaTags.push(
        { name: 'schema-org', content: JSON.stringify(schemaOrgData) },
      );
    }

    return {
      success: true,
      context,
    };
  } catch (err) {
    return {
      success: false,
      error: {
        code: 'ALL_TIERS_FAILED',
        message: err instanceof Error ? err.message : String(err),
        tier: 'innertext',
      },
    };
  }
}

// ─── DOM Readiness ───────────────────────────────────────────────────

function ensureDomReady(): Promise<void> {
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('DOM not ready after timeout'));
    }, DOM_READY_TIMEOUT_MS);

    document.addEventListener('DOMContentLoaded', () => {
      clearTimeout(timeout);
      resolve();
    }, { once: true });
  });
}

// ─── Schema.org Extraction ───────────────────────────────────────────

/**
 * Extract structured data from Schema.org JSON-LD and Microdata.
 *
 * Pattern: based on obsidian-clipper's addSchemaOrgDataToVariables()
 * in src/variables/schema-org-variables.ts.
 */
export function extractSchemaOrgData(doc: Document): Record<string, unknown> | null {
  const data: Record<string, unknown> = {};

  // 1. JSON-LD script tags
  const jsonLdScripts = doc.querySelectorAll<HTMLScriptElement>(
    'script[type="application/ld+json"]',
  );
  const jsonLdItems: unknown[] = [];

  for (const script of jsonLdScripts) {
    try {
      const parsed = JSON.parse(script.textContent || '');
      if (Array.isArray(parsed)) {
        jsonLdItems.push(...parsed);
      } else if (parsed && typeof parsed === 'object') {
        jsonLdItems.push(parsed);
      }
    } catch {
      // Skip malformed JSON-LD
    }
  }

  if (jsonLdItems.length > 0) {
    data['@jsonld'] = jsonLdItems;
  }

  // 2. Microdata (itemscope / itemtype)
  const microdataItems: Array<Record<string, unknown>> = [];
  const scopedElements = doc.querySelectorAll('[itemscope]');

  for (const el of scopedElements) {
    const item: Record<string, unknown> = {};
    const itemType = el.getAttribute('itemtype');
    if (itemType) {
      item['@type'] = itemType;
    }

    const props = el.querySelectorAll('[itemprop]');
    for (const prop of props) {
      const name = prop.getAttribute('itemprop');
      if (!name) continue;

      const value =
        (prop as HTMLMetaElement).content ||
        prop.getAttribute('content') ||
        prop.textContent?.trim() ||
        '';

      // Avoid overwriting nested props
      if (!(name in item)) {
        item[name] = value;
      }
    }

    if (Object.keys(item).length > 1) {
      microdataItems.push(item);
    }
  }

  if (microdataItems.length > 0) {
    data['@microdata'] = microdataItems;
  }

  // 3. Open Graph / Twitter meta tags
  const ogTags: Record<string, string> = {};
  const metaTags = doc.querySelectorAll<HTMLMetaElement>('meta[property^="og:"], meta[name^="twitter:"]');
  for (const meta of metaTags) {
    const key = meta.getAttribute('property') || meta.getAttribute('name');
    const content = meta.getAttribute('content');
    if (key && content) {
      ogTags[key] = content;
    }
  }
  if (Object.keys(ogTags).length > 0) {
    data['@opengraph'] = ogTags;
  }

  return Object.keys(data).length > 0 ? data : null;
}
