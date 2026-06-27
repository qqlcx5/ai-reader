// ============================================================
// Developer Export Variant — code-enhanced + extended metadata
// ============================================================

import type { SavedArticle } from '../../../shared/domain';
import type { ObsidianExportOptions, ExportResult } from '../../obsidian-exporter';
import { buildFrontmatter, renderYamlFrontmatter, sanitizeFilename } from '../../obsidian-exporter';

export const VARIANT_ID = 'developer' as const;
export const VARIANT_NAME = '开发者增强';
export const VARIANT_DESCRIPTION = '含代码块高亮标注、扩展元数据字段（ID、更新时间、字数统计）';

export function exportArticle(
  article: SavedArticle,
  options: ObsidianExportOptions = {},
): ExportResult {
  const fm = buildFrontmatter(article, { ...options, variant: 'developer' });

  let body = article.markdown || article.contentText || '';

  // Enhance code blocks with language labels
  body = body.replace(/```(\w*)\n([\s\S]*?)```/g, (_match, lang, code) => {
    const label = lang ? `\`\`\`${lang}` : '```';
    return `${label}\n${code.trim()}\n\`\`\``;
  });

  // Add metadata footer
  const footer = [
    '',
    '---',
    '',
    '## 文件元信息',
    '',
    `- **ID**: \`${article.id}\``,
    `- **URL**: ${article.url}`,
    `- **捕获时间**: ${article.createdAt}`,
    `- **更新时间**: ${article.updatedAt}`,
    `- **阅读时间**: ${article.readingTime} 分钟`,
    `- **字数**: ${(article.contentText || '').length}`,
  ].join('\n');

  return {
    filename: sanitizeFilename(article.title) + '.md',
    content: renderYamlFrontmatter(fm) + '\n' + body + footer,
    frontmatter: fm,
  };
}
