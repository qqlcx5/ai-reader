/**
 * Capture-layer types.
 *
 * The capture pipeline produces a `CapturedDocument` (see
 * `@db/schema`) and may report additional progress events to
 * the side panel. This file is intentionally tiny: heavy types
 * live alongside the schema so they stay in sync with what the
 * persistence layer persists.
 */

/** Options accepted by `extractPageContent`. */
export interface ExtractOptions {
  /** Page URL — passed to defuddle so it can resolve relative links. */
  url?: string
  /** When true, ask defuddle to return a Markdown string. Default true. */
  markdown?: boolean
  /** When true, run defuddle's async extractors (e.g. Reddit comments). */
  useAsync?: boolean
}

/** Result of one extraction attempt, with provenance for debugging. */
export interface ExtractionResult {
  /** The normalised document. */
  document: import('@db/schema').CapturedDocument
  /** Which path produced the content. */
  source: 'defuddle' | 'fallback'
  /** How long extraction took (ms). */
  durationMs: number
}

/** Errors thrown by the capture pipeline. */
export class CaptureError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message)
    this.name = 'CaptureError'
  }
}
