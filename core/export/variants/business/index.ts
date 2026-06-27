// ============================================================
// Business Export Variant — attachment links + business template
// ============================================================

import type { SavedArticle } from '../../../shared/domain';
import type { ObsidianExportOptions, ExportResult } from '../../obsidian-exporter';
import { buildFrontmatter, renderYamlFrontmatter, sanitizeFilename } from '../../obsidian-exporter';

export const VARIANT_ID = 'business' as const;
export const VARIANT_NAME = '商务模板';
export const VARIANT_DESCRIPTION = '附加原网页链接、商业摘要模板、文档类型标注';

export function exportArticle(
  article: SavedArticle,
  options: ObsidianExportOptions = {},
): ExportResult {
  const fm = buildFrontmatter(article, { ...options, variant: 'business' });

  let body = article.markdown || article.contentText || '';

  // Business header block
  const header = [
    `# ${article.title}`,
    '',
    `> **来源**: [${article.siteName || article.url}](${article.url})`,
    `> **作者**: ${article.author || '未知'}`,
    `> **归档日期**: ${article.createdAt || ''}`,
    `> **阅读时间**: ${article.readingTime} 分钟`,
    '',
    '## 摘要',
    '',
    article.excerpt || '无摘要',
    '',
    '---',
    '',
  ].join('\n');

  // Remove the original h1 title from body to avoid duplication
  const titleRegex = new RegExp(`^#\\s+${escapeRegex(article.title)}\\s*`, 'm');
  body = body.replace(titleRegex, '').trim();

  return {
    filename: sanitizeFilename(article.title) + '.md',
    content: renderYamlFrontmatter(fm) + '\n' + header + body,
    frontmatter: fm,
  };
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
