/**
 * M7 — Local file export (single record).
 *
 * Exports a conversation record to the user's filesystem via the
 * <a download> trick. Three formats are supported:
 *  - Markdown (.md)  — includes YAML front-matter
 *  - HTML (.html)    — includes inline CSS for standalone viewing
 *  - Plain text (.txt)
 *
 * Also exposes `copyToClipboard(text)` for one-click clipboard copy.
 */

// ─── Shared types ─────────────────────────────────────────────────────────────

export interface LocalExportRecord {
  title: string;
  /** Canonical page URL */
  url?: string;
  /** Markdown-formatted body */
  markdown: string;
  /** Engine used for extraction */
  engine?: string;
  /** Source text length (characters) */
  sourceLength?: number;
  /** Whether the content was truncated */
  truncation?: boolean;
  /** Models applied in the conversation */
  modelsApplied?: string[];
  /** ISO 8601 creation timestamp */
  createdAt?: string;
}

// ─── Markdown export ──────────────────────────────────────────────────────────

/**
 * Download the record as a Markdown file with YAML front-matter.
 */
export function exportAsMarkdown(record: LocalExportRecord): void {
  const content = buildMarkdownWithFrontmatter(record);
  triggerDownload(content, `${sanitizeFilename(record.title)}.md`, 'text/markdown;charset=utf-8');
}

// ─── HTML export ─────────────────────────────────────────────────────────────

/**
 * Download the record as a standalone HTML file.
 * The markdown is converted to HTML using a lightweight pass; inline CSS
 * ensures the file is readable without external stylesheets.
 */
export function exportAsHtml(record: LocalExportRecord): void {
  const markdownBody = buildMarkdownWithFrontmatter(record);
  const html = buildHtml(record.title, markdownToHtml(markdownBody));
  triggerDownload(html, `${sanitizeFilename(record.title)}.html`, 'text/html;charset=utf-8');
}

// ─── Plain text export ────────────────────────────────────────────────────────

/**
 * Download the record as plain UTF-8 text. Front-matter is omitted;
 * headers are replaced with `=` / `-` underlines for readability.
 */
export function exportAsText(record: LocalExportRecord): void {
  const lines: string[] = [record.title, '='.repeat(record.title.length), ''];
  if (record.url) lines.push(`Source: ${record.url}`, '');
  lines.push(stripMarkdown(record.markdown));
  triggerDownload(lines.join('\n'), `${sanitizeFilename(record.title)}.txt`, 'text/plain;charset=utf-8');
}

// ─── Clipboard ────────────────────────────────────────────────────────────────

/** Copy markdown (with front-matter) to the system clipboard. */
export async function copyToClipboard(markdown: string): Promise<void> {
  await navigator.clipboard.writeText(markdown);
}

/** Copy plain text (no front-matter) to the system clipboard. */
export async function copyPlainToClipboard(record: LocalExportRecord): Promise<void> {
  const text = `${record.title}\n${'='.repeat(record.title.length)}\n\n${stripMarkdown(record.markdown)}`;
  await navigator.clipboard.writeText(text);
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function buildMarkdownWithFrontmatter(record: LocalExportRecord): string {
  const fm: string[] = ['---'];
  fm.push(`title: ${yamlEscapeInline(record.title)}`);
  if (record.url) fm.push(`source: ${yamlEscapeInline(record.url)}`);
  if (record.sourceLength != null) fm.push(`source_length: ${record.sourceLength}`);
  if (record.engine) fm.push(`engine: ${record.engine}`);
  if (record.truncation != null) fm.push(`truncation: ${record.truncation}`);
  if (record.modelsApplied?.length)
    fm.push(`models_applied: [${record.modelsApplied.map((m) => `"${m}"`).join(', ')}]`);
  if (record.createdAt) fm.push(`created: ${record.createdAt}`);
  fm.push('---', '');
  return fm.join('\n') + record.markdown;
}

function buildHtml(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<style>
  body { max-width: 780px; margin: 2rem auto; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; line-height: 1.7; color: #1a1a1a; padding: 0 1rem; }
  h1 { font-size: 1.75rem; border-bottom: 2px solid #7c3aed; padding-bottom: .5rem; }
  h2 { font-size: 1.25rem; color: #7c3aed; margin-top: 2rem; }
  pre, code { background: #f4f4f8; padding: .2em .4em; border-radius: 4px; font-family: "JetBrains Mono", monospace; font-size: .875em; }
  pre code { padding: 0; background: none; }
  pre { padding: 1rem; overflow-x: auto; }
  blockquote { border-left: 4px solid #7c3aed; margin: 0; padding-left: 1rem; color: #555; }
  hr { border: none; border-top: 1px solid #e0e0e0; margin: 2rem 0; }
  a { color: #7c3aed; }
</style>
</head>
<body>${body}</body>
</html>`;
}

/** Minimal markdown → HTML (headings, bold, italic, code, links, hr). */
function markdownToHtml(md: string): string {
  // Strip YAML front-matter
  const stripped = md.replace(/^---[\s\S]*?---\n?/, '');
  return stripped
    .replace(/^#{6}\s+(.+)$/gm, '<h6>$1</h6>')
    .replace(/^#{5}\s+(.+)$/gm, '<h5>$1</h5>')
    .replace(/^#{4}\s+(.+)$/gm, '<h4>$1</h4>')
    .replace(/^###\s+(.+)$/gm, '<h3>$1</h3>')
    .replace(/^##\s+(.+)$/gm, '<h2>$1</h2>')
    .replace(/^#\s+(.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>')
    .replace(/^---$/gm, '<hr />')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(?!<[h|p|b|o|u|l|d|h])(.+)$/gm, '<p>$1</p>');
}

function stripMarkdown(md: string): string {
  return md
    .replace(/#{1,6}\s+/g, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')
    .replace(/^---$/gm, '')
    .trim();
}

function triggerDownload(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(url);
  }, 0);
}

function sanitizeFilename(name: string): string {
  return name
    .replace(/[\\/:*?"<>|\x00-\x1f]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200) || 'untitled';
}

function yamlEscapeInline(value: string): string {
  if (!value) return '""';
  const needsQuote =
    /^[-?:,&*!|>'"%@`#,{}\[\]\s]/.test(value) ||
    /[:]\s/.test(value) ||
    /[\n\r]/.test(value) ||
    /^(true|false|null)$/.test(value);
  return needsQuote ? `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"` : value;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
