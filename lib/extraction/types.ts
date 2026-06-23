/**
 * M2 — lib/extraction unified types
 *
 * ExtractionResult is the canonical output of the extraction orchestrator.
 * All fields containing content MUST NOT be truncated at any point.
 */

export type ExtractionEngine = 'readability' | 'defuddle' | 'fallback';
export type ConfidenceLevel = 'high' | 'medium' | 'low';
export type HighlightMode = 'embedded' | 'only' | 'ignored';
export type HighlightStyle = 'mark' | 'underline' | 'blur' | 'wave' | 'bold' | 'italic';

export interface SchemaOrgData {
  '@type': string;
  [key: string]: unknown;
}

export interface PageMetadata {
  /** Page title */
  title: string;
  /** Author name */
  author?: string;
  /** Page description */
  description?: string;
  /** Publication date (ISO string or human-readable) */
  published?: string;
  /** Site name */
  site?: string;
  /** Domain (hostname) */
  domain?: string;
  /** Favicon URL (absolute) */
  favicon?: string;
  /** Social image URL (og:image) */
  image?: string;
  /** Estimated word count */
  words?: number;
  /** Open Graph title */
  ogTitle?: string;
  /** Open Graph description */
  ogDescription?: string;
  /** Open Graph image URL */
  ogImage?: string;
  /** Parsed Schema.org / JSON-LD objects */
  schemaOrg?: SchemaOrgData[];
}

/**
 * Unified extraction result.
 * NO TRUNCATION: markdown / rawText must be passed through unmodified.
 */
export interface ExtractionResult {
  /** Full Markdown of the extracted article — NO TRUNCATION */
  markdown: string;
  /** Which engine produced the result */
  engine: ExtractionEngine;
  /** CJK + English word count */
  wordCount: number;
  /** Structured page metadata */
  metadata: PageMetadata;
  /** Confidence level of the extraction quality */
  confidence: ConfidenceLevel;
  /** Raw plain text alias — NO TRUNCATION, used by LLM context injection */
  rawText: string;
}

/** Options passed to the extraction orchestrator */
export interface OrchestratorOptions {
  /** Minimum content length to accept from an engine (default 200) */
  minContentLength?: number;
  /** Defuddle timeout in milliseconds (default 8000) */
  defuddleTimeoutMs?: number;
}

/** A persisted highlight attached to a page */
export interface HighlightRecord {
  /** Unique identifier */
  id: string;
  /** Associated conversation / page id (Conversation.id in M8) */
  pageId: string;
  /** CSS selector used to re-locate the highlighted DOM node */
  selector: string;
  /** The selected text */
  text: string;
  /** Visual style preset */
  style: HighlightStyle;
  /** Creation timestamp (ms since epoch) */
  createdAt: number;
  /** Full page URL */
  url: string;
  /** Page domain (for grouping) */
  domain: string;
}
