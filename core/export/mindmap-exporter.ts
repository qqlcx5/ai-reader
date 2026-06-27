// ============================================================
// MindMap Exporter — MDX / JSON brain map export
// ============================================================

import type { SavedArticle } from '../../shared/domain';

// ---- Types ----

export type MindMapFormat = 'mdx' | 'json';

export interface MindMapExportOptions {
  format: MindMapFormat;
  /** Custom title override */
  title?: string;
}

export interface MindMapJson {
  id: string;
  title: string;
  content: string;
  sourceUrl: string;
  capturedAt: string;
  summary: string;
  tags: string[];
  aiAnalysis?: string;
}

// ---- Core ----

/**
 * Export a saved article as a brain map (MDX or JSON).
 */
export function exportMindMap(
  article: SavedArticle,
  options: MindMapExportOptions,
): string {
  const { format } = options;

  if (format === 'json') {
    return exportMindMapJson(article);
  }
  return exportMindMapMdx(article, options);
}

/**
 * Export as JSON brain map.
 */
export function exportMindMapJson(article: SavedArticle): string {
  const map: MindMapJson = {
    id: article.id,
    title: article.title,
    content: article.markdown || article.contentText || '',
    sourceUrl: article.url,
    capturedAt: article.createdAt || article.publishedAt || new Date().toISOString(),
    summary: article.excerpt || '',
    tags: (article as any).tags ?? [],
    aiAnalysis: (article as any).aiSummary ?? undefined,
  };

  return JSON.stringify(map, null, 2);
}

/**
 * Export as MDX brain map with nested headings and MindMap component.
 */
export function exportMindMapMdx(
  article: SavedArticle,
  options: MindMapExportOptions = { format: 'mdx' },
): string {
  const title = options.title || article.title;
  const parts: string[] = [];

  // Frontmatter
  parts.push('---');
  parts.push(`title: "${escapeYaml(title)}"`);
  parts.push(`source: "${escapeYaml(article.url)}"`);
  parts.push(`capturedAt: "${article.createdAt || ''}"`);
  const tags = (article as any).tags ?? [];
  if (tags.length > 0) {
    parts.push('tags:');
    for (const t of tags) {
      parts.push(`  - "${escapeYaml(String(t))}"`);
    }
  }
  parts.push('---');
  parts.push('');

  // Import
  parts.push("import { MindMap } from '@/components/MindMap';");
  parts.push('');

  // MDX content — nested headings from markdown structure
  parts.push(`# ${title}`);
  parts.push('');

  if (article.excerpt) {
    parts.push(`> ${article.excerpt}`);
    parts.push('');
  }

  // Process markdown into nested structure
  const headings = parseHeadings(article.markdown || article.contentText || '');
  for (const h of headings) {
    parts.push(h);
    parts.push('');
  }

  // AI analysis section
  if ((article as any).aiSummary) {
    parts.push('## AI 分析');
    parts.push('');
    parts.push((article as any).aiSummary);
    parts.push('');
  }

  // MindMap component
  parts.push(`<MindMap`);
  parts.push(`  title="${escapeYaml(title)}"`);
  parts.push(`  sourceUrl="${escapeYaml(article.url)}"`);
  parts.push(`  capturedAt="${article.createdAt || ''}"`);
  if (tags.length > 0) {
    parts.push(`  tags={[${tags.map(t => `"${escapeYaml(String(t))}"`).join(', ')}]}`);
  }
  parts.push(`/>`);

  return parts.join('\n');
}

// ---- Helpers ----

interface Heading {
  level: number;
  text: string;
}

/**
 * Parse markdown headings into a flat list of {level, text}.
 */
export function parseHeadings(markdown: string): string[] {
  const lines = markdown.split('\n');
  const result: string[] = [];

  for (const line of lines) {
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      const level = match[1].length;
      const text = match[2].trim();
      const prefix = '#'.repeat(level);
      result.push(`${prefix} ${text}`);
    }
  }

  return result;
}

function escapeYaml(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}
