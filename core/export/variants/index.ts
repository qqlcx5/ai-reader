// ============================================================
// Export Variants Registry
// ============================================================

import type { SavedArticle } from '../../../shared/domain';
import type { ObsidianExportOptions, ExportResult } from '../obsidian-exporter';
import * as defaultVariant from './default';
import * as developerVariant from './developer';
import * as businessVariant from './business';

export interface VariantMeta {
  id: string;
  name: string;
  description: string;
}

export type VariantExporter = (
  article: SavedArticle,
  options: ObsidianExportOptions,
) => ExportResult;

const registry = new Map<string, { meta: VariantMeta; exporter: VariantExporter }>();

function register(module: {
  VARIANT_ID: string;
  VARIANT_NAME: string;
  VARIANT_DESCRIPTION: string;
  exportArticle: VariantExporter;
}) {
  registry.set(module.VARIANT_ID, {
    meta: {
      id: module.VARIANT_ID,
      name: module.VARIANT_NAME,
      description: module.VARIANT_DESCRIPTION,
    },
    exporter: module.exportArticle,
  });
}

register(defaultVariant as any);
register(developerVariant as any);
register(businessVariant as any);

/**
 * List all registered variants.
 */
export function listVariants(): VariantMeta[] {
  return Array.from(registry.values()).map((v) => v.meta);
}

/**
 * Get a variant exporter by ID. Falls back to 'default' if not found.
 */
export function getVariantExporter(variantId: string): VariantExporter {
  const entry = registry.get(variantId);
  if (entry) return entry.exporter;
  return registry.get('default')!.exporter;
}

/**
 * Check if a variant ID is registered.
 */
export function hasVariant(variantId: string): boolean {
  return registry.has(variantId);
}
