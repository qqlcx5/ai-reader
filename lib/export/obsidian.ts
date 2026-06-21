/**
 * M6 — Obsidian URI builder.
 *
 * Obsidian registers the `obsidian://` URL scheme. The `new` action lets
 * a caller pass `vault`, `file`, and `content` as query parameters to
 * create a new note. We construct the URL and either open it in a new
 * tab (which the OS will route to Obsidian) or, when the encoded URL
 * exceeds a safe threshold, fall back to a `.md` download.
 */
import {
  OBSIDIAN_URI_SAFE_BYTES,
  PayloadTooLargeError,
  type ObsidianOptions,
} from './types';

/** Build a `obsidian://new?vault=...&file=...&content=...` URI. */
export function buildObsidianUri(
  title: string,
  content: string,
  options: ObsidianOptions,
): string {
  const file = options.folder
    ? `${options.folder.replace(/^\/+|\/+$/g, '')}/${sanitizeFileName(title)}.md`
    : `${sanitizeFileName(title)}.md`;

  const params = new URLSearchParams();
  params.set('vault', options.vault);
  params.set('file', file);
  params.set('content', content);

  return `obsidian://new?${params.toString()}`;
}

/** Approximate byte length (UTF-8 encoded). */
export function byteLength(value: string): number {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(value).length;
  }
  // Fallback: count UTF-16 code units as a conservative upper bound.
  return value.length * 2;
}

/**
 * Returns the safe URI when the encoded length fits, otherwise throws
 * `PayloadTooLargeError` so the caller can fall back to a download.
 */
export function buildSafeObsidianUri(
  title: string,
  content: string,
  options: ObsidianOptions,
): string {
  const uri = buildObsidianUri(title, content, options);
  const length = byteLength(uri);
  if (length > OBSIDIAN_URI_SAFE_BYTES) {
    throw new PayloadTooLargeError(length, OBSIDIAN_URI_SAFE_BYTES);
  }
  return uri;
}

/**
 * Open the URI by creating an anchor with target=_blank and clicking it.
 * Browser must be configured to allow `obsidian://` redirects.
 */
export function openObsidianUri(uri: string): void {
  const a = document.createElement('a');
  a.href = uri;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  // Some browsers require the anchor to be in the DOM to fire the click.
  document.body.appendChild(a);
  a.click();
  // Schedule cleanup so we don't leak DOM nodes.
  setTimeout(() => a.remove(), 0);
}

/** Trigger a download of the markdown file. */
export function downloadAsMarkdown(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.md') ? filename : `${filename}.md`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(url);
  }, 0);
}

/**
 * Strip characters that are illegal in Windows / macOS / Linux file names.
 * Mirrors Obsidian's own sanitization rules (we don't reuse Obsidian's
 * because that would be a runtime dependency).
 */
export function sanitizeFileName(name: string): string {
  return name
    .replace(/[\\/:*?"<>|\x00-\x1f]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200) || 'untitled';
}
