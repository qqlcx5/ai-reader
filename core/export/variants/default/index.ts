// ============================================================
// Default Export Variant — standard Obsidian markdown
// ============================================================

import type { SavedArticle } from '../../../shared/domain';
import type { ObsidianExportOptions, ExportResult } from '../../obsidian-exporter';
import { buildFrontmatter, renderYamlFrontmatter, sanitizeFilename } from '../../obsidian-exporter';

export const VARIANT_ID = 'default' as const;
export const VARIANT_NAME = '标准导出';
export const VARIANT_DESCRIPTION = '标准 Obsidian Markdown，含 YAML Frontmatter 与正文';

export function exportArticle(
  article: SavedArticle,
  options: ObsidianExportOptions = {},
): ExportResult {
  const fm = buildFrontmatter(article, { ...options, variant: 'default' });
  const body = article.markdown || article.contentText || '';

  return {
    filename: sanitizeFilename(article.title) + '.md',
    content: renderYamlFrontmatter(fm) + '\n' + body,
    frontmatter: fm,
  };
}
