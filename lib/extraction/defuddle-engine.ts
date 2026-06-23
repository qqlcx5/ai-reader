/**
 * M2 — Defuddle extraction engine
 *
 * Uses the `defuddle` npm package with a configurable timeout (default 8 s).
 * On timeout the function rejects, causing the orchestrator to fall back to
 * the innerText engine.
 *
 * Promise.race is used so that a slow or hung defuddle run is abandoned
 * after the timeout fires, even if the async import is delayed.
 */
import type { ExtractionResult, ConfidenceLevel, PageMetadata } from './types';

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

export async function runDefuddleEngine(
  doc: Document,
  timeoutMs = 8_000,
): Promise<ExtractionResult | null> {
  const timeoutPromise = new Promise<null>((_, reject) =>
    setTimeout(() => reject(new Error(`[M2/defuddle] Timed out after ${timeoutMs} ms`)), timeoutMs),
  );

  const extractPromise = (async (): Promise<ExtractionResult | null> => {
    const mod = await import('defuddle');
    const DefuddleClass = (mod as any).default ?? mod;

    // defuddle v0.19: new Defuddle(doc, opts).parse()
    const instance = new (DefuddleClass as any)(doc, { markdown: true });
    const result: any = typeof instance.parse === 'function' ? instance.parse() : instance;

    const markdown: string = result?.markdown ?? result?.content ?? result?.text ?? '';
    if (!markdown || markdown.length < 200) return null;

    const wordCount = estimateWordCount(markdown);
    const confidence = calcConfidence(markdown);

    const metadata: PageMetadata = {
      title: result.title ?? doc.title ?? '',
      author: result.author ?? result.byline ?? undefined,
      description: result.description ?? result.excerpt ?? undefined,
      site: result.siteName ?? result.site_name ?? undefined,
      domain: (doc.location as Location | undefined)?.hostname ?? '',
      words: wordCount,
    };

    return {
      markdown,
      engine: 'defuddle',
      wordCount,
      confidence,
      rawText: markdown,
      metadata,
    };
  })();

  try {
    return await Promise.race([extractPromise, timeoutPromise]);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('Timed out')) {
      console.warn(msg);
    } else {
      console.error('[M2/defuddle] Extraction error:', err);
    }
    return null;
  }
}
