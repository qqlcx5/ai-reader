/**
 * Extraction module — Core types
 *
 * Based on design-02-extraction.md and obsidian-clipper's ExtractedContent interface.
 */

// ─── Extraction Result ───────────────────────────────────────────────

export interface ExtractedContext {
  /** Cleaned HTML body content (primary extraction) */
  content: string;
  /** Markdown version of content (for display/storage) */
  markdown: string;
  /** Full cleaned HTML including <head> metadata (for offline archive) */
  fullHtml: string;

  /** Document metadata extracted during parsing */
  metadata: PageMetadata;

  /** Why this tier was chosen (debuggability) */
  extractorType: ExtractorType;
  /** Extraction duration in ms */
  parseTime: number;
}

export interface PageMetadata {
  title: string;
  author: string;
  description: string;
  published: string;
  site: string;
  domain: string;
  favicon: string;
  image: string;
  url: string;
  wordCount: number;
  language: string;
  /** Raw meta tags for custom variable templates */
  metaTags: Array<{ name?: string | null; property?: string | null; content: string | null }>;
}

export type ExtractorType = 'defuddle' | 'readability' | 'innertext';

// ─── Extraction Pipeline ─────────────────────────────────────────────

export interface ExtractionRequest {
  /** URL of the page to extract (used to find the tab) */
  url?: string;
  /** Tab ID for direct content script injection */
  tabId?: number;
  /** Extraction timeout in ms (default: 15000) */
  timeoutMs?: number;
  /** If true, bypass cache and force re-extraction */
  forceRefresh?: boolean;
  /** Context anchor for Tab-specific tracking */
  anchorId?: string;
}

export interface ExtractionResponse {
  success: boolean;
  context?: ExtractedContext;
  error?: ExtractionError;
}

export interface ExtractionError {
  code: ExtractionErrorCode;
  message: string;
  /** Which tier the error occurred at */
  tier: ExtractorType;
}

export type ExtractionErrorCode =
  | 'TAB_NOT_FOUND'
  | 'CONTENT_SCRIPT_INJECTION_FAILED'
  | 'EXTRACTION_TIMEOUT'
  | 'ALL_TIERS_FAILED'
  | 'CONTEXT_ANCHOR_MISMATCH';

// ─── Chunked Transfer Protocol ────────────────────────────────────────

export const CHUNK_SIZE = 1 * 1024 * 1024; // 1 MB per chunk
export const CHUNK_MAX_RETRIES = 3;

export interface ChunkHeader {
  /** Unique transfer session ID */
  transferId: string;
  /** 0-based chunk index */
  chunkIndex: number;
  /** Total number of chunks */
  totalChunks: number;
  /** Payload encoding */
  encoding: 'base64' | 'utf-8';
}

export interface ChunkPayload {
  header: ChunkHeader;
  /** Encoded chunk data */
  data: string;
}

export interface TransferSession {
  transferId: string;
  totalChunks: number;
  receivedChunks: Set<number>;
  /** Assembled payload (when complete) */
  result?: string;
  startedAt: number;
}

// ─── Context Anchoring ──────────────────────────────────────────────

export interface ContextAnchor {
  anchorId: string;
  tabId: number;
  url: string;
  /** Extracted context cache (used to detect staleness) */
  contextHash?: string;
  createdAt: number;
  lastAccessedAt: number;
}
