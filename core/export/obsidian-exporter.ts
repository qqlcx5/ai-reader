// ============================================================
// Obsidian Exporter — generates .md files with YAML frontmatter
// ============================================================

import type { SavedArticle } from '../../shared/domain';

// ---- Types ----

export interface ObsidianExportOptions {
  /** Variant: 'default' | 'developer' | 'business' */
  variant?: string;
  /** Override frontmatter tags */
  tags?: string[];
  /** Include AI analysis summary if available */
  includeAiSummary?: boolean;
  /** Custom frontmatter fields to append */
  extraFrontmatter?: Record<string, string | string[]>;
}

export interface ExportResult {
  filename: string;
  content: string;
  frontmatter: Record<string, unknown>;
}

// ---- Core ----

/**
 * Generate an Obsidian-compatible Markdown file from a saved article.
 */
export function exportArticleObsidian(
  article: SavedArticle,
  options: ObsidianExportOptions = {},
): ExportResult {
  const { variant = 'default', tags, includeAiSummary = false, extraFrontmatter } = options;

  const frontmatter = buildFrontmatter(article, { tags, includeAiSummary, extraFrontmatter, variant });
  const body = article.markdown || article.contentText || '';

  const frontmatterYaml = renderYamlFrontmatter(frontmatter);
  const content = frontmatterYaml + '\n' + body + (includeAiSummary && (article as any).aiSummary ? '\n\n## AI 分析\n\n' + (article as any).aiSummary : '');

  return {
    filename: sanitizeFilename(article.title) + '.md',
    content,
    frontmatter,
  };
}

/**
 * Build the frontmatter object for an article.
 */
export function buildFrontmatter(
  article: SavedArticle,
  opts: {
    tags?: string[];
    includeAiSummary?: boolean;
    extraFrontmatter?: Record<string, string | string[]>;
    variant?: string;
  } = {},
): Record<string, unknown> {
  const fm: Record<string, unknown> = {};

  fm.title = article.title;
  fm.source = article.url;
  fm.created = formatDate(article.createdAt || article.publishedAt || new Date().toISOString());

  if (article.author) fm.author = article.author;
  if (article.siteName) fm.site_name = article.siteName;

  const tags = opts.tags ?? (article as any).tags ?? [];
  if (tags.length > 0) fm.tags = tags;

  if (article.excerpt) fm.excerpt = article.excerpt;
  if (article.readingTime) fm.reading_time = article.readingTime;

  // Variant-specific fields
  if (opts.variant === 'developer') {
    fm.id = article.id;
    fm.updated_at = article.updatedAt;
    fm.word_count = (article.contentText || '').length;
  }

  if (opts.variant === 'business') {
    fm.captured_at = article.createdAt;
    fm.document_type = 'web-clip';
  }

  // Extra custom fields
  if (opts.extraFrontmatter) {
    Object.assign(fm, opts.extraFrontmatter);
  }

  return fm;
}

// ---- Helpers ----

/**
 * Sanitize a string for safe filenames.
 * Removes characters illegal in Windows/macOS file systems.
 */
export function sanitizeFilename(title: string): string {
  return title
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '')  // Strip illegal chars
    .replace(/\s+/g, ' ')                     // Collapse whitespace
    .trim()
    .slice(0, 200);                           // Truncate
}

/**
 * Render a frontmatter object to YAML string.
 */
export function renderYamlFrontmatter(fm: Record<string, unknown>): string {
  const lines = ['---'];

  for (const [key, value] of Object.entries(fm)) {
    if (value === undefined || value === null) continue;
    if (typeof value === 'string') {
      lines.push(`${key}: "${escapeYaml(value)}"`);
    } else if (Array.isArray(value)) {
      if (value.length === 0) {
        lines.push(`${key}: []`);
      } else {
        lines.push(`${key}:`);
        for (const item of value) {
          lines.push(`  - "${escapeYaml(String(item))}"`);
        }
      }
    } else {
      lines.push(`${key}: ${value}`);
    }
  }

  lines.push('---');
  return lines.join('\n');
}

/**
 * Format ISO date to YYYY-MM-DD.
 */
export function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso.slice(0, 10);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  } catch {
    return iso.slice(0, 10);
  }
}

function escapeYaml(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

// ---- Browser Utilities ----

/**
 * Trigger a browser download of a string as a file.
 */
export function downloadFile(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Copy string content to the clipboard.
 */
export async function copyToClipboard(content: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(content);
    return true;
  } catch {
    // Fallback: execCommand for older browsers / no clipboard permission
    const textarea = document.createElement('textarea');
    textarea.value = content;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  }
}
