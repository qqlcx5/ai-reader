/**
 * QuoteProcessor — Deduplicates LLM output against input context
 *
 * When the LLM echoes back large portions of the source document verbatim
 * (a common behavior in "AI reader" workflows), the QuoteProcessor strips
 * these echoes from the streamed output so users see net-new content only.
 *
 * Based on nextai-translator's quote deduplication logic.
 *
 * Design rationale (design-03-provider-client.md §9):
 * - Fuzzy matching with configurable similarity threshold
 * - Sliding window comparison on streamed text
 * - Strip echoed quotes to reduce token waste and improve readability
 */

// ─── Types ────────────────────────────────────────────────────────────

export interface QuoteProcessorOptions {
  /** Minimum length of a quote to consider for deduplication (chars) */
  minQuoteLength: number;
  /** Similarity threshold (0-1), higher = stricter matching */
  similarityThreshold: number;
  /** Maximum context window to search in (chars) */
  maxContextWindow: number;
}

export const DEFAULT_QUOTE_OPTIONS: QuoteProcessorOptions = {
  minQuoteLength: 20,
  similarityThreshold: 0.85,
  maxContextWindow: 5000,
};

// ─── QuoteProcessor ───────────────────────────────────────────────────

export class QuoteProcessor {
  private options: QuoteProcessorOptions;
  private contextBuffer: string = '';

  constructor(options: Partial<QuoteProcessorOptions> = {}) {
    this.options = { ...DEFAULT_QUOTE_OPTIONS, ...options };
  }

  /**
   * Set the source context text. Called once at the start of a session
   * with the full extracted article text.
   */
  setContext(context: string): void {
    // Keep only the tail of context within maxContextWindow for efficiency
    if (context.length > this.options.maxContextWindow) {
      this.contextBuffer = context.slice(-this.options.maxContextWindow);
    } else {
      this.contextBuffer = context;
    }
  }

  /**
   * Append to context buffer (e.g. when streaming article text in chunks).
   */
  appendContext(text: string): void {
    this.contextBuffer += text;
    const excess = this.contextBuffer.length - this.options.maxContextWindow;
    if (excess > 0) {
      this.contextBuffer = this.contextBuffer.slice(excess);
    }
  }

  /**
   * Process a chunk of LLM output. Returns the portion of chunk that
   * is NOT an echo of the context.
   *
   * Call this for each `delta` before forwarding to the UI.
   */
  processChunk(chunk: string): string {
    if (chunk.length < this.options.minQuoteLength) {
      return chunk;
    }

    // Sliding window: find the longest non-echo prefix
    let bestNonEchoEnd = 0;
    for (let end = this.options.minQuoteLength; end <= chunk.length; end++) {
      const candidate = chunk.slice(0, end);
      if (this.isEchoOfContext(candidate)) {
        continue; // This prefix is an echo, keep looking
      }
      bestNonEchoEnd = end;
    }

    if (bestNonEchoEnd === 0) {
      // Entire chunk is an echo
      return '';
    }

    return chunk.slice(bestNonEchoEnd > 0 ? chunk.indexOf(chunk.slice(bestNonEchoEnd - 1)) : 0);
  }

  // ─── Internal ──────────────────────────────────────────────────────

  /**
   * Check if text is substantially an echo of the context buffer.
   * Uses Levenshtein distance for fuzzy matching.
   */
  private isEchoOfContext(text: string): boolean {
    if (this.contextBuffer.length === 0) return false;

    const threshold = this.options.similarityThreshold;
    const maxDistance = Math.ceil(text.length * (1 - threshold));

    // Scan context buffer for similar segments
    for (let i = 0; i <= this.contextBuffer.length - text.length; i++) {
      const segment = this.contextBuffer.slice(i, i + text.length);
      const distance = this.levenshteinDistance(text, segment);
      const similarity = 1 - distance / text.length;
      if (similarity >= threshold) {
        return true;
      }

      // Early exit: if we've accumulated enough distance already
      if (distance <= maxDistance) {
        return true;
      }
    }

    return false;
  }

  /**
   * Levenshtein edit distance between two strings.
   * Returns 0-1 normalized by text length.
   */
  private levenshteinDistance(a: string, b: string): number {
    const m = a.length;
    const n = b.length;

    if (m === 0) return n;
    if (n === 0) return m;

    // Use single row for memory efficiency
    let prevRow = new Uint16Array(n + 1);
    let currRow = new Uint16Array(n + 1);

    for (let j = 0; j <= n; j++) {
      prevRow[j] = j;
    }

    for (let i = 1; i <= m; i++) {
      currRow[0] = i;
      for (let j = 1; j <= n; j++) {
        currRow[j] = a[i - 1] === b[j - 1]
          ? prevRow[j - 1]
          : 1 + Math.min(prevRow[j - 1], prevRow[j], currRow[j - 1]);
      }
      [prevRow, currRow] = [currRow, prevRow];
    }

    return prevRow[n];
  }

  /** Reset state for a new session. */
  reset(): void {
    this.contextBuffer = '';
  }
}
