/**
 * M5 — Workflow Filters (纯函数 Filter 集).
 *
 * Every filter is a pure function:  (input: string, ...args: string[]) => string
 * Some filters accept an array input and return a string (join-style).
 *
 * 46 filters total:
 *  Text transforms (18): capitalize, upper, lower, trim, ltrim, rtrim, replace,
 *    strip_tags, strip_md, safe_name, truncate, slug, sentence, word_count,
 *    char_count, excerpt, bold, italic
 *  Structure transforms (8): blockquote, callout, code, heading, link, footnote,
 *    table, wrap
 *  List operations (14): split, slice, reverse, merge, join, map, template,
 *    sort, unique, first, last, nth, count, compact
 *  Date handling (2): date, date_modify
 *  Utility (4): default, pad_left, pad_right, repeat
 */

export type FilterFn = (input: string, ...args: string[]) => string;

// ─── Text transforms ─────────────────────────────────────────────────────────

/** Capitalize each word. */
export const capitalize: FilterFn = (s) =>
  s.replace(/\b\w/g, (c) => c.toUpperCase());

/** All-uppercase. */
export const upper: FilterFn = (s) => s.toUpperCase();

/** All-lowercase. */
export const lower: FilterFn = (s) => s.toLowerCase();

/** Strip leading and trailing whitespace. */
export const trim: FilterFn = (s) => s.trim();

/** Strip leading whitespace. */
export const ltrim: FilterFn = (s) => s.trimStart();

/** Strip trailing whitespace. */
export const rtrim: FilterFn = (s) => s.trimEnd();

/** Replace occurrences of `from` with `to`. */
export const replace: FilterFn = (s, from = '', to = '') =>
  s.split(from).join(to);

/** Remove HTML tags. */
export const strip_tags: FilterFn = (s) => s.replace(/<[^>]*>/g, '');

/** Remove common Markdown syntax (headings, bold, italic, links, code). */
export const strip_md: FilterFn = (s) =>
  s
    .replace(/^#{1,6}\s+/gm, '')           // headings
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1') // bold/italic
    .replace(/_([^_]+)_/g, '$1')            // underscore italic
    .replace(/`([^`]+)`/g, '$1')            // inline code
    .replace(/```[\s\S]*?```/g, '')         // fenced code
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // links
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1') // images
    .replace(/^\s*[-*+]\s+/gm, '')          // list bullets
    .replace(/^\s*\d+\.\s+/gm, '');         // numbered lists

/**
 * Make a string safe to use as a filename or variable name:
 * lowercase, spaces→underscores, remove non-alphanumeric.
 */
export const safe_name: FilterFn = (s) =>
  s
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_-]/g, '');

/**
 * Truncate to `n` characters (default 100), appending "…".
 */
export const truncate: FilterFn = (s, n = '100') => {
  const len = parseInt(n, 10);
  return s.length <= len ? s : `${s.slice(0, len)}…`;
};

/**
 * Convert to URL-friendly slug: lowercase, spaces→hyphens.
 */
export const slug: FilterFn = (s) =>
  s
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

/** Uppercase only the first character. */
export const sentence: FilterFn = (s) =>
  s.length === 0 ? s : s[0].toUpperCase() + s.slice(1).toLowerCase();

/** Return word count as a string. */
export const word_count: FilterFn = (s) =>
  String(s.trim() === '' ? 0 : s.trim().split(/\s+/).length);

/** Return character count as a string. */
export const char_count: FilterFn = (s) => String(s.length);

/**
 * Return first `n` words (default 50) followed by "…".
 */
export const excerpt: FilterFn = (s, n = '50') => {
  const words = s.trim().split(/\s+/);
  const len = parseInt(n, 10);
  return words.length <= len ? s : `${words.slice(0, len).join(' ')}…`;
};

/** Wrap in Markdown bold (**). */
export const bold: FilterFn = (s) => `**${s}**`;

/** Wrap in Markdown italic (*). */
export const italic: FilterFn = (s) => `*${s}*`;

// ─── Structure transforms ─────────────────────────────────────────────────────

/** Prefix each line with "> " (Markdown blockquote). */
export const blockquote: FilterFn = (s) =>
  s
    .split('\n')
    .map((line) => `> ${line}`)
    .join('\n');

/**
 * Wrap in an Obsidian-style callout block.
 * `type` defaults to "info".
 */
export const callout: FilterFn = (s, type = 'info') =>
  `> [!${type}]\n${s
    .split('\n')
    .map((l) => `> ${l}`)
    .join('\n')}`;

/**
 * Wrap in a fenced code block.
 * `lang` defaults to empty (plain text).
 */
export const code: FilterFn = (s, lang = '') => `\`\`\`${lang}\n${s}\n\`\`\``;

/**
 * Prefix with Markdown heading markers.
 * `level` defaults to 2.
 */
export const heading: FilterFn = (s, level = '2') => {
  const l = Math.max(1, Math.min(6, parseInt(level, 10)));
  return `${'#'.repeat(l)} ${s}`;
};

/**
 * Create a Markdown link: [text](url).
 * `text` defaults to the input value; `url` is required as first arg.
 */
export const link: FilterFn = (s, text) => {
  if (!text) return s;
  return `[${text}](${s})`;
};

/**
 * Append input as a numbered footnote stub.
 * Returns "[^1]: <input>".
 */
export const footnote: FilterFn = (s) => `[^1]: ${s}`;

/**
 * Convert a newline-separated list of items into a Markdown table.
 * First item becomes the header row.
 */
export const table: FilterFn = (s) => {
  const rows = s.split('\n').filter((r) => r.trim());
  if (rows.length === 0) return s;
  const header = `| ${rows[0]} |`;
  const sep    = `| ${rows[0].replace(/[^|]/g, '-')} |`;
  const body   = rows.slice(1).map((r) => `| ${r} |`).join('\n');
  return [header, sep, body].filter(Boolean).join('\n');
};

/**
 * Wrap a string with a prefix and suffix.
 * `prefix` and `suffix` default to empty.
 */
export const wrap: FilterFn = (s, prefix = '', suffix = '') =>
  `${prefix}${s}${suffix}`;

// ─── List operations ─────────────────────────────────────────────────────────

/**
 * Split the input string by `sep` (default newline) and return as JSON array
 * string. Consumers that need actual arrays should call this before join/map.
 *
 * Note: Since all filters operate on strings, "list" is represented as a
 * newline-joined string internally.
 */
export const split: FilterFn = (s, sep = '\n') =>
  s.split(sep).join('\n');

/**
 * Return lines start..end (0-indexed, exclusive end, like Array.slice).
 */
export const slice: FilterFn = (s, start = '0', end?: string) => {
  const lines = s.split('\n');
  const a = parseInt(start, 10);
  const b = end !== undefined ? parseInt(end, 10) : undefined;
  return (b !== undefined ? lines.slice(a, b) : lines.slice(a)).join('\n');
};

/** Reverse the order of lines. */
export const reverse: FilterFn = (s) =>
  s.split('\n').reverse().join('\n');

/** Merge multiple lines with a custom separator (default ", "). */
export const merge: FilterFn = (s, sep = ', ') =>
  s.split('\n').filter(Boolean).join(sep);

/** Join lines with a custom separator (default "\n"). */
export const join: FilterFn = (s, sep = '\n') =>
  s.split('\n').join(sep);

/**
 * Map each line through a simple template.
 * Use `{item}` as the placeholder in the template.
 */
export const map: FilterFn = (s, tpl = '{item}') =>
  s
    .split('\n')
    .map((line) => tpl.replace(/\{item\}/g, line))
    .join('\n');

/**
 * Apply a template string to each line, same as `map`.
 * Kept as an alias with a more explicit name.
 */
export const template: FilterFn = (s, tpl = '{item}') => map(s, tpl);

/** Sort lines alphabetically. */
export const sort: FilterFn = (s) =>
  s.split('\n').sort().join('\n');

/** Remove duplicate lines (preserving first occurrence). */
export const unique: FilterFn = (s) => {
  const seen = new Set<string>();
  return s
    .split('\n')
    .filter((l) => {
      if (seen.has(l)) return false;
      seen.add(l);
      return true;
    })
    .join('\n');
};

/** Return the first non-empty line. */
export const first: FilterFn = (s) =>
  s.split('\n').find((l) => l.trim()) ?? '';

/** Return the last non-empty line. */
export const last: FilterFn = (s) => {
  const lines = s.split('\n').filter((l) => l.trim());
  return lines[lines.length - 1] ?? '';
};

/**
 * Return the nth line (0-indexed).
 */
export const nth: FilterFn = (s, n = '0') => {
  const lines = s.split('\n');
  const i = parseInt(n, 10);
  return lines[i] ?? '';
};

/** Return the number of non-empty lines as a string. */
export const count: FilterFn = (s) =>
  String(s.split('\n').filter((l) => l.trim()).length);

/** Remove empty lines. */
export const compact: FilterFn = (s) =>
  s.split('\n').filter((l) => l.trim()).join('\n');

// ─── Date handling ────────────────────────────────────────────────────────────

/**
 * Format a date.
 * Input may be a Unix timestamp (ms), ISO string, or "now".
 * `format` tokens: YYYY, MM, DD, HH, mm, ss.
 * Defaults to "YYYY-MM-DD".
 */
export const date: FilterFn = (s, format = 'YYYY-MM-DD') => {
  const d = s === 'now' || s === '' ? new Date() : new Date(isNaN(Number(s)) ? s : Number(s));
  if (isNaN(d.getTime())) return s;
  return format
    .replace('YYYY', String(d.getFullYear()))
    .replace('MM',   String(d.getMonth() + 1).padStart(2, '0'))
    .replace('DD',   String(d.getDate()).padStart(2, '0'))
    .replace('HH',   String(d.getHours()).padStart(2, '0'))
    .replace('mm',   String(d.getMinutes()).padStart(2, '0'))
    .replace('ss',   String(d.getSeconds()).padStart(2, '0'));
};

/**
 * Modify a date by adding/subtracting an amount.
 * `amount` is a signed integer string.
 * `unit` is one of: years, months, days, hours, minutes, seconds (default days).
 */
export const date_modify: FilterFn = (s, amount = '0', unit = 'days') => {
  const d = s === 'now' || s === '' ? new Date() : new Date(isNaN(Number(s)) ? s : Number(s));
  if (isNaN(d.getTime())) return s;
  const n = parseInt(amount, 10);
  switch (unit) {
    case 'years':   d.setFullYear(d.getFullYear() + n); break;
    case 'months':  d.setMonth(d.getMonth() + n); break;
    case 'hours':   d.setHours(d.getHours() + n); break;
    case 'minutes': d.setMinutes(d.getMinutes() + n); break;
    case 'seconds': d.setSeconds(d.getSeconds() + n); break;
    default:        d.setDate(d.getDate() + n); break; // days
  }
  return d.toISOString();
};

// ─── Utility filters ─────────────────────────────────────────────────────────

/**
 * Return `fallback` if the input is empty/blank.
 */
export const default_val: FilterFn = (s, fallback = '') =>
  s.trim() === '' ? fallback : s;

/** Pad the string on the left to length `n` with `char` (default space). */
export const pad_left: FilterFn = (s, n = '0', char = ' ') => {
  const len = parseInt(n, 10);
  return s.padStart(len, char);
};

/** Pad the string on the right to length `n` with `char` (default space). */
export const pad_right: FilterFn = (s, n = '0', char = ' ') => {
  const len = parseInt(n, 10);
  return s.padEnd(len, char);
};

/**
 * Repeat the string `n` times (default 1), joined by `sep` (default "").
 */
export const repeat: FilterFn = (s, n = '2', sep = '') =>
  Array.from({ length: Math.max(0, parseInt(n, 10)) }, () => s).join(sep);

// ─── Registry ────────────────────────────────────────────────────────────────

/**
 * Canonical whitelist of all filter functions.
 * Keys are the names used in `{{var|filterName}}` syntax.
 */
export const FILTERS: Record<string, FilterFn> = {
  // Text transforms
  capitalize,
  upper,
  lower,
  trim,
  ltrim,
  rtrim,
  replace,
  strip_tags,
  strip_md,
  safe_name,
  truncate,
  slug,
  sentence,
  word_count,
  char_count,
  excerpt,
  bold,
  italic,
  // Structure transforms
  blockquote,
  callout,
  code,
  heading,
  link,
  footnote,
  table,
  wrap,
  // List operations
  split,
  slice,
  reverse,
  merge,
  join,
  map,
  template,
  sort,
  unique,
  first,
  last,
  nth,
  count,
  compact,
  // Date handling
  date,
  date_modify,
  // Utility
  default: default_val,
  pad_left,
  pad_right,
  repeat,
};

export const FILTER_NAMES = new Set(Object.keys(FILTERS));
