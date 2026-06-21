/**
 * Extraction Module — Unified Export
 *
 * Provides:
 * - Three-tier extraction pipeline (Defuddle → Readability → innerText)
 * - Markdown conversion
 * - Chunked transfer protocol
 * - Context anchoring (Tab ↔ content binding)
 *
 * Based on design-02-extraction.md and obsidian-clipper's extraction pipeline.
 */

// ─── Core Pipeline ────────────────────────────────────────────────────

export { extractPage, extract, summarizeTiers } from './extractors/index';
export type { TierResult } from './extractors/index';

// ─── Extractors (individual, for direct use) ─────────────────────────

export { extractWithDefuddle } from './extractors/defuddle';
export { extractWithReadability } from './extractors/readability';
export { extractWithInnerText } from './extractors/inner-text';

// ─── Markdown ────────────────────────────────────────────────────────

export { contentToMarkdown } from './markdown';

// ─── Chunked Transfer ─────────────────────────────────────────────────

export {
  chunkify,
  sendChunks,
  receiveChunk,
  ChunkReceiver,
} from './transfer';
export type { ChunkSender } from './transfer';

// ─── Context Anchoring ───────────────────────────────────────────────

export {
  setAnchor,
  getAnchor,
  isAnchorValid,
  cacheContext,
  getCachedContext,
  isCacheValid,
  removeAnchor,
  cleanupStaleAnchors,
} from './context-anchor';

// ─── Content Script Entry ────────────────────────────────────────────

export { extractSchemaOrgData } from './content-script';

// ─── Types ───────────────────────────────────────────────────────────

export type {
  ExtractedContext,
  PageMetadata,
  ExtractorType,
  ExtractionRequest,
  ExtractionResponse,
  ExtractionError,
  ExtractionErrorCode,
  ChunkHeader,
  ChunkPayload,
  TransferSession,
  ContextAnchor,
} from './types';

export {
  CHUNK_SIZE,
  CHUNK_MAX_RETRIES,
} from './types';
