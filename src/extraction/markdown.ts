/**
 * Markdown Converter
 *
 * Converts extracted HTML content to Markdown for storage and display.
 * Uses Obsidian-compatible Markdown syntax by default.
 *
 * Based on obsidian-clipper's markdown filter:
 *   import { createMarkdownContent } from 'defuddle/full';
 */

// ─── Primary: defuddle/full Markdown ──────────────────────────────────

/**
 * Convert HTML to Markdown using defuddle/full's converter.
 *
 * The defuddle/full createMarkdownContent produces Obsidian-compatible
 * Markdown with proper link/image URL resolution.
 */
function convertViaDefuddle(html: string, baseUrl: string): string | null {
  try {
    // Try to use defuddle/full's built-in converter
    // Note: this requires 'defuddle' package to be installed
    // In browser extension context, we can import dynamically
    const g = globalThis as any;
    if (g.createMarkdownContent) {
      return g.createMarkdownContent(html, baseUrl);
    }
    // Dynamic require for bundler support
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('defuddle/full');
    if (mod?.createMarkdownContent) {
      return mod.createMarkdownContent(html, baseUrl);
    }
    return null;
  } catch {
    return null;
  }
}

// ─── Fallback: Simple HTML-to-Markdown ────────────────────────────────

/**
 * Minimal HTML-to-Markdown converter for environments without defuddle/full.
 *
 * Handles the most common elements found in article extraction.
 */
function simpleHtmlToMarkdown(html: string, baseUrl: string): string {
  // Strip <script> and <style>
  let md = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');

  // Headings
  md = md.replace(/<\/h([1-6])>/gi, '\n\n');
  md = md.replace(/<h([1-6])[^>]*>/gi, (_: string, n: string) => `\n\n${'#'.repeat(Number(n))} `);

  // Paragraphs and line breaks
  md = md.replace(/<\/p>/gi, '\n\n');
  md = md.replace(/<br\s*\/?>/gi, '\n');
  md = md.replace(/<\/?p[^>]*>/gi, '');

  // Bold and italic
  md = md.replace(/<\/?(?:strong|b)>/gi, '**');
  md = md.replace(/<\/?(?:em|i)>/gi, '*');

  // Links
  md = md.replace(/<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
    (_: string, href: string, text: string) => {
      const resolved = resolveUrl(href, baseUrl);
      return `[${text.trim()}](${resolved})`;
    },
  );

  // Images
  md = md.replace(/<img[^>]*src=["']([^"']+)["'][^>]*alt=["']([^"']*)["'][^>]*\/?>/gi,
    (_: string, src: string, alt: string) => `![${alt}](${resolveUrl(src, baseUrl)})`,
  );
  md = md.replace(/<img[^>]*src=["']([^"']+)["'][^>]*\/?>/gi,
    (_: string, src: string) => `![](${resolveUrl(src, baseUrl)})`,
  );

  // Lists
  md = md.replace(/<\/li>/gi, '\n');
  md = md.replace(/<li[^>]*>/gi, '- ');
  md = md.replace(/<\/?[ou]l[^>]*>/gi, '\n');

  // Code
  md = md.replace(/<\/?code>/gi, '`');
  md = md.replace(/<pre[^>]*>/gi, '\n```\n');
  md = md.replace(/<\/pre>/gi, '\n```\n');

  // Blockquotes
  md = md.replace(/<\/blockquote>/gi, '');
  md = md.replace(/<blockquote[^>]*>/gi, '\n> ');

  // Horizontal rules
  md = md.replace(/<hr\s*\/?>/gi, '\n---\n');

  // Strip remaining tags
  md = md.replace(/<[^>]+>/g, '');

  // Decode entities
  md = md
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');

  // Collapse whitespace
  md = md
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();

  return md;
}

// ─── Public API ──────────────────────────────────────────────────────

/**
 * Convert HTML content to Markdown.
 *
 * Tries defuddle/full's createMarkdownContent first (produces best
 * results), falls back to the built-in simple converter.
 *
 * @param html - The HTML string to convert
 * @param baseUrl - Base URL for resolving relative links
 * @returns Markdown string
 */
export function contentToMarkdown(html: string, baseUrl: string = 'about:blank'): string {
  // Try defuddle/full first
  const defuddleMd = convertViaDefuddle(html, baseUrl);
  if (defuddleMd && defuddleMd.trim().length > 0) {
    return defuddleMd;
  }

  // Fallback
  return simpleHtmlToMarkdown(html, baseUrl);
}

// ─── Helpers ─────────────────────────────────────────────────────────

function resolveUrl(href: string, baseUrl: string): string {
  try {
    return new URL(href, baseUrl).href;
  } catch {
    return href;
  }
}
