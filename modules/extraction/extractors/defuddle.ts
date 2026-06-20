/**
 * M2 — Defuddle extractor
 * Uses defuddle npm package with 8s timeout.
 */
import type { ExtractedContext } from '../types';

function estimateWordCount(text: string): number {
  const cn = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  const en = (text.match(/[a-zA-Z]+/g) || []).length;
  return cn + en;
}

function generateFingerprint(text: string): string {
  return text.slice(0, 500).replace(/\s+/g, ' ');
}

export async function extractWithDefuddle(
  doc: Document,
  timeoutMs: number = 8000
): Promise<ExtractedContext | null> {
  try {
    const defuddleModule = await import('defuddle');
    const defuddle = defuddleModule.default || (defuddleModule as any).defuddle || defuddleModule;

    const extractPromise = new Promise<ExtractedContext | null>((resolve) => {
      try {
        const result = defuddle(doc, { markdown: true });
        const content = result?.markdown || result?.content || result?.text || '';
        if (!content || content.length < 200) {
          resolve(null);
          return;
        }
        resolve({
          url: doc.location?.href || '',
          title: result.title || doc.title || '',
          siteName: result.siteName || result.site_name || '',
          extractedAt: Date.now(),
          wordCount: estimateWordCount(content),
          content,
          format: 'markdown',
          extractor: 'defuddle',
          htmlFingerprint: generateFingerprint(content),
        });
      } catch (innerErr) {
        console.error('[M2] Defuddle inner error:', innerErr);
        resolve(null);
      }
    });

    const timeoutPromise = new Promise<null>((_, reject) => {
      setTimeout(() => reject(new Error('Defuddle timeout')), timeoutMs);
    });

    return await Promise.race([extractPromise, timeoutPromise]);
  } catch (e) {
    console.error('[M2] Defuddle extraction failed:', e);
    return null;
  }
}
