// ============================================================
// Markdown Generator for SuperBrain Content Extraction
// ============================================================

import type { ExtractResult, PageMetadata } from '../../shared/domain';

/**
 * Generates a complete Markdown document with YAML frontmatter
 * from extraction results and page metadata.
 *
 * @param extractResult - The defuddle extraction output
 * @param metadata - Page metadata (title, author, publishedAt, etc.)
 * @returns Full Markdown string with frontmatter + content
 */
export function generateMarkdown(
  extractResult: ExtractResult,
  metadata: PageMetadata,
): string {
  const frontmatter = buildFrontmatter(extractResult, metadata);
  const body = extractResult.contentHtml
    ? convertHtmlToMarkdown(extractResult.contentHtml, extractResult.url)
    : extractResult.contentText;

  return frontmatter + '\n' + body;
}

/**
 * Builds YAML frontmatter block.
 */
export function buildFrontmatter(
  extractResult: ExtractResult,
  metadata: PageMetadata,
): string {
  const lines: string[] = ['---'];

  const fields: Array<[string, string | undefined]> = [
    ['title', escapeYaml(metadata.title || extractResult.title)],
    ['url', extractResult.url],
    ['site_name', escapeYaml(metadata.siteName || extractResult.siteName)],
    ['author', escapeYaml(metadata.author || extractResult.author)],
    ['published_at', metadata.publishedAt || extractResult.publishedAt || undefined],
    ['description', escapeYaml(metadata.description || extractResult.excerpt)],
    ['image', extractResult.image || undefined],
    ['favicon_url', metadata.faviconUrl || undefined],
    ['lang', metadata.lang || undefined],
    ['reading_time', extractResult.readingTime ? String(extractResult.readingTime) : undefined],
    ['captured_at', new Date().toISOString()],
  ];

  for (const [key, value] of fields) {
    if (value !== undefined && value !== '') {
      lines.push(`${key}: "${value}"`);
    }
  }

  lines.push('---');
  return lines.join('\n');
}

/**
 * Basic HTML-to-Markdown conversion using defuddle/full's createMarkdownContent
 * when available, with a lightweight fallback.
 *
 * Note: This function is called from content.ts after dynamic import,
 * so the import cost is only paid during actual extraction.
 */
export async function htmlToMarkdown(
  html: string,
  url: string,
): Promise<string> {
  try {
    const { createMarkdownContent } = await import('defuddle/full');
    return createMarkdownContent(html, url);
  } catch {
    // Fallback: defuddle/full not available – return HTML wrapped for safe storage
    return `<!-- raw HTML: defuddle/full markdown not available -->\n\n${html}`;
  }
}

/**
 * Synchronous lightweight HTML-to-Markdown converter for use when
 * defuddle/full is unavailable or for simple content.
 * Strips most HTML tags but preserves structure.
 */
export function convertHtmlToMarkdown(html: string, _url: string): string {
  // Lightweight conversion: strip tags, preserve line breaks
  let md = html
    // Headings
    .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '\n# $1\n')
    .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '\n## $1\n')
    .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '\n### $1\n')
    .replace(/<h4[^>]*>(.*?)<\/h4>/gi, '\n#### $1\n')
    .replace(/<h5[^>]*>(.*?)<\/h5>/gi, '\n##### $1\n')
    .replace(/<h6[^>]*>(.*?)<\/h6>/gi, '\n###### $1\n')
    // Bold and italic
    .replace(/<(strong|b)[^>]*>(.*?)<\/(strong|b)>/gi, '**$2**')
    .replace(/<(em|i)[^>]*>(.*?)<\/(em|i)>/gi, '*$2*')
    // Links
    .replace(/<a[^>]*href=["']([^"']*)["'][^>]*>(.*?)<\/a>/gi, '[$2]($1)')
    // Images
    .replace(/<img[^>]*src=["']([^"']*)["'][^>]*alt=["']([^"']*)["'][^>]*\/?>/gi, '![$2]($1)')
    .replace(/<img[^>]*src=["']([^"']*)["'][^>]*\/?>/gi, '![]($1)')
    // Lists
    .replace(/<\/li>\s*<li[^>]*>/gi, '\n- ')
    .replace(/<li[^>]*>/gi, '\n- ')
    .replace(/<\/li>/gi, '')
    .replace(/<\/ul>/gi, '\n')
    .replace(/<ul[^>]*>/gi, '\n')
    .replace(/<\/ol>/gi, '\n')
    .replace(/<ol[^>]*>/gi, '\n')
    // Paragraphs and breaks
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<p[^>]*>/gi, '')
    // Blockquotes
    .replace(/<blockquote[^>]*>/gi, '\n> ')
    .replace(/<\/blockquote>/gi, '\n')
    // Code
    .replace(/<pre[^>]*><code[^>]*>/gi, '\n```\n')
    .replace(/<\/code><\/pre>/gi, '\n```\n')
    .replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`')
    // Horizontal rules
    .replace(/<hr\s*\/?>/gi, '\n---\n')
    // Remaining tags: strip
    .replace(/<[^>]*>/g, '')
    // Entities
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    // Clean up whitespace
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return md;
}

function escapeYaml(value: string): string {
  return value.replace(/"/g, '\\"');
}
