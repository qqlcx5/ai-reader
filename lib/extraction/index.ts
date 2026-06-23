/**
 * M2 — lib/extraction barrel export
 *
 * Public surface of the extraction pipeline.
 * Import from '@/lib/extraction' in other modules.
 */

// Types
export type {
  ExtractionEngine,
  ConfidenceLevel,
  HighlightMode,
  HighlightStyle,
  SchemaOrgData,
  PageMetadata,
  ExtractionResult,
  OrchestratorOptions,
  HighlightRecord,
} from './types';

// Engines
export { runReadabilityEngine } from './readability-engine';
export { runDefuddleEngine } from './defuddle-engine';
export { runFallbackEngine } from './fallback-engine';

// Metadata
export { extractMetadata } from './metadata-extractor';

// Orchestrator
export { orchestrateExtraction } from './extraction-orchestrator';

// Highlighter
export { Highlighter, setHighlightsRepository } from './highlighter';
export type { HighlightsRepository, HighlighterOptions } from './highlighter';

// Area selector
export { AreaSelector } from './area-selector';
export type { AreaSelectionResult, AreaSelectorCallback } from './area-selector';
