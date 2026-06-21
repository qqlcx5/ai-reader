/**
 * Extraction Orchestrator — Three-Tier Fallback Pipeline
 *
 * Tries extractors in priority order:
 *   1. Defuddle (semantic, async-variable support)
 *   2. Readability (DOM-based, wide browser support)
 *   3. innerText (guaranteed fallback)
 *
 * Each tier is progressively less sophisticated but more robust.
 * The orchestrator captures tier-level errors and only surfaces a
 * combined error if ALL tiers fail.
 *
 * Based on design-02-extraction.md §2 and obsidian-clipper's
 * content extraction pipeline.
 */

import type { ExtractedContext, ExtractionRequest, ExtractionError, ExtractorType } from '../types';
import { extractWithDefuddle } from './defuddle';
import { extractWithReadability } from './readability';
import { extractWithInnerText } from './inner-text';

type ExtractorFn = (doc: Document, req: ExtractionRequest) => Promise<ExtractedContext>;

interface TierResult {
  tier: ExtractorType;
  error?: string;
}

export async function extractPage(
  doc: Document,
  req: ExtractionRequest,
): Promise<{ context: ExtractedContext; tiers: TierResult[] }> {
  const tiers: TierResult[] = [];

  const extractors: Array<{ name: ExtractorType; fn: ExtractorFn | ((doc: Document) => ExtractedContext) }> = [
    { name: 'defuddle', fn: extractWithDefuddle },
    { name: 'readability', fn: extractWithReadability as ExtractorFn },
    { name: 'innertext', fn: extractWithInnerText as (doc: Document) => ExtractedContext },
  ];

  for (const { name, fn } of extractors) {
    try {
      const result = await fn(doc, req);
      // Verify the extraction produced meaningful content
      if (result.content && result.content.trim().length > 0) {
        tiers.push({ tier: name });
        return { context: result, tiers };
      }
      tiers.push({ tier: name, error: 'Empty content returned' });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      tiers.push({ tier: name, error: message });
    }
  }

  // All tiers failed — this should never happen because innerText is a
  // guaranteed fallback, but handle it defensively.
  throw new Error(`All extraction tiers failed: ${JSON.stringify(tiers)}`);
}

/**
 * Convenience: extract with a supported Document and return
 * only the context (or throw).
 */
export async function extract(
  doc: Document,
  req: ExtractionRequest = {},
): Promise<ExtractedContext> {
  const { context } = await extractPage(doc, req);
  return context;
}

/**
 * Diagnostic: analyze tier results for observability.
 */
export function summarizeTiers(tiers: TierResult[]): string {
  const used = tiers[tiers.length - 1];
  const failed = tiers.slice(0, -1).map((t) => `${t.tier}: ${t.error}`);
  return failed.length > 0
    ? `Fell back to ${used.tier} after failures: ${failed.join('; ')}`
    : `Used ${used.tier} (first choice)`;
}
