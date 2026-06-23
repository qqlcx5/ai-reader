/**
 * M2 — Extraction orchestrator
 *
 * Runs three extraction engines in priority order, falling back to the next
 * engine when the current one fails or returns low-quality content:
 *
 *   1. Readability (synchronous, local, no network)
 *   2. Defuddle    (async, 8 s timeout via Promise.race)
 *   3. Fallback    (innerText strip — always succeeds)
 *
 * After extraction the shared metadata extractor enriches the result with
 * Open Graph and JSON-LD fields.
 *
 * IMPORTANT: markdown / rawText in the returned ExtractionResult must NEVER
 * be truncated or sliced. Pass them through verbatim to the LLM context layer.
 */
import { runReadabilityEngine } from './readability-engine';
import { runDefuddleEngine } from './defuddle-engine';
import { runFallbackEngine } from './fallback-engine';
import { extractMetadata } from './metadata-extractor';
import type { ExtractionResult, OrchestratorOptions } from './types';

const DEFAULT_MIN_LEN = 200;
const DEFAULT_TIMEOUT = 8_000;

/**
 * Run extraction with automatic three-level fallback.
 *
 * @param doc       The page Document (or a jsdom Document in tests).
 * @param options   Optional tuning (minContentLength, defuddleTimeoutMs).
 * @returns         A fully populated ExtractionResult — never throws.
 */
export async function orchestrateExtraction(
  doc: Document,
  options: OrchestratorOptions = {},
): Promise<ExtractionResult> {
  const minLen = options.minContentLength ?? DEFAULT_MIN_LEN;
  const timeout = options.defuddleTimeoutMs ?? DEFAULT_TIMEOUT;

  // ── Level 1: Readability ────────────────────────────────────────────────
  const readabilityResult = runReadabilityEngine(doc);
  if (readabilityResult && readabilityResult.markdown.length >= minLen) {
    const meta = extractMetadata(doc);
    return mergeMetadata(readabilityResult, meta);
  }

  // ── Level 2: Defuddle (with 8 s timeout) ───────────────────────────────
  const defuddleResult = await runDefuddleEngine(doc, timeout);
  if (defuddleResult && defuddleResult.markdown.length >= minLen) {
    const meta = extractMetadata(doc);
    return mergeMetadata(defuddleResult, meta);
  }

  // ── Level 3: Fallback — always returns something ───────────────────────
  const fallbackResult = runFallbackEngine(doc);
  const meta = extractMetadata(doc);
  return mergeMetadata(fallbackResult, meta);
}

/**
 * Merge richer metadata-extractor output (OG + JSON-LD) on top of the
 * engine-level metadata, preferring the richer source for each field.
 */
function mergeMetadata(
  result: ExtractionResult,
  richMeta: ExtractionResult['metadata'],
): ExtractionResult {
  return {
    ...result,
    metadata: {
      ...result.metadata,
      // Prefer richer OG / JSON-LD values but keep engine values as fallback
      title: richMeta.title || result.metadata.title,
      author: richMeta.author ?? result.metadata.author,
      description: richMeta.description ?? result.metadata.description,
      published: richMeta.published ?? result.metadata.published,
      site: richMeta.site ?? result.metadata.site,
      domain: richMeta.domain || result.metadata.domain,
      favicon: richMeta.favicon ?? result.metadata.favicon,
      image: richMeta.image ?? result.metadata.image,
      words: result.wordCount,
      ogTitle: richMeta.ogTitle,
      ogDescription: richMeta.ogDescription,
      ogImage: richMeta.ogImage,
      schemaOrg: richMeta.schemaOrg,
    },
  };
}
