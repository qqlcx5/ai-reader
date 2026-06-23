/**
 * M5 — Variable Resolver (变量解析器).
 *
 * Resolves {{variableName}}, {{meta:property:og:title}}, {{schema:@Article.headline}}
 * within prompt template strings.
 *
 * Design principles:
 *  - Compile-time static analysis: extract all variable names, warn on undefined.
 *  - NO eval() or Function() — pure regex + string manipulation.
 *  - Supports filter chains: {{var|filter1|filter2(arg)}}
 *  - Meta / Schema paths are pass-through (not validated at compile time).
 */

/**
 * Page context provided at resolve time.
 * All fields are optional — missing values emit warnings instead of crashing.
 */
export interface PageContext {
  /** User-defined or upstream workflow variables. */
  variables?: Record<string, string>;
  /** Flat map of meta tag content, keyed as "property:og:title" or "name:description". */
  meta?: Record<string, string>;
  /** Schema.org graph keyed by type (e.g. "@Article" → { headline: "…" }). */
  schema?: Record<string, Record<string, unknown>>;
  /** Full page text content. */
  content?: string;
  /** Page title. */
  title?: string;
  /** Page author. */
  author?: string;
  /** Current URL. */
  url?: string;
  /** Currently selected text. */
  selection?: string;
}

export interface ResolveOptions {
  /** Called for each variable name that could not be resolved. */
  onUndefined?: (name: string) => void;
  /**
   * Optional filter executor injected by filter-pipeline.
   * Receives the resolved string value and an array of raw filter tokens
   * (e.g. ["capitalize", "upper"]).
   */
  applyFilters?: (value: string, filters: string[]) => string;
}

// Matches {{...}} including nested content (no nested braces allowed).
const TOKEN_RE = /\{\{([^{}]+)\}\}/g;

/** COMMON_VARS covers the standard page variables always available at runtime. */
const COMMON_VARS = new Set([
  'content',
  'title',
  'author',
  'url',
  'selection',
]);

/**
 * Static analysis: extract all variable names referenced in a template.
 *
 * Returns raw variable specifiers (without filters, without braces).
 * Meta / Schema specifiers are returned as-is (e.g. "meta:property:og:title").
 */
export function extractVariableNames(template: string): string[] {
  const names: string[] = [];
  const re = new RegExp(TOKEN_RE.source, 'g');
  let match: RegExpExecArray | null;
  while ((match = re.exec(template)) !== null) {
    const inner = match[1].trim();
    // Strip filter chain — everything before the first |
    const varPart = inner.split('|')[0].trim();
    names.push(varPart);
  }
  return names;
}

/**
 * Validate a template at "compile time".
 *
 * Returns an array of variable names that are neither in `availableVars`,
 * COMMON_VARS, nor prefixed with `meta:` / `schema:`.
 * These should be treated as warnings, not hard errors.
 */
export function validateTemplateVars(
  template: string,
  availableVars: Set<string> = new Set(),
): string[] {
  const names = extractVariableNames(template);
  return names.filter(
    (n) =>
      !availableVars.has(n) &&
      !COMMON_VARS.has(n) &&
      !n.startsWith('meta:') &&
      !n.startsWith('schema:'),
  );
}

// ─── Internal variable lookup ────────────────────────────────────────────────

function lookupVar(name: string, ctx: PageContext): string | undefined {
  // Meta tag: {{meta:property:og:title}} → ctx.meta['property:og:title']
  if (name.startsWith('meta:')) {
    const key = name.slice(5);
    return ctx.meta?.[key];
  }

  // Schema.org: {{schema:@Article.headline}} → ctx.schema['@Article']['headline']
  if (name.startsWith('schema:')) {
    return resolveSchemaPath(name.slice(7), ctx.schema);
  }

  // Common page variables
  switch (name) {
    case 'content':   return ctx.content;
    case 'title':     return ctx.title;
    case 'author':    return ctx.author;
    case 'url':       return ctx.url;
    case 'selection': return ctx.selection;
  }

  // User-defined variables (e.g. upstream workflow outputs)
  return ctx.variables?.[name];
}

/**
 * Resolve a Schema.org path like "@Article.headline".
 *
 * Supports:
 *  - "@Article.headline"     → ctx.schema["@Article"]["headline"]
 *  - "@Article.author.name"  → ctx.schema["@Article"]["author"]["name"]  (up to 2 hops)
 */
function resolveSchemaPath(
  path: string,
  schema?: Record<string, Record<string, unknown>>,
): string | undefined {
  if (!schema) return undefined;

  const dotIdx = path.indexOf('.');
  if (dotIdx === -1) return undefined;

  const typeKey = path.slice(0, dotIdx);    // e.g. "@Article"
  const rest    = path.slice(dotIdx + 1);   // e.g. "headline" or "author.name"

  const typeObj = schema[typeKey];
  if (!typeObj) return undefined;

  const parts = rest.split('.');
  let cursor: unknown = typeObj;
  for (const part of parts) {
    if (cursor == null || typeof cursor !== 'object') return undefined;
    cursor = (cursor as Record<string, unknown>)[part];
  }
  return typeof cursor === 'string' ? cursor : undefined;
}

// ─── Main resolver ───────────────────────────────────────────────────────────

/**
 * Resolve all `{{...}}` tokens in `template` using `ctx`.
 *
 * - Unknown variables are left as-is and reported via `opts.onUndefined`.
 * - Filter chains are delegated to `opts.applyFilters`; if not provided,
 *   filters are silently ignored (value is returned unfiltered).
 */
export function resolveVariables(
  template: string,
  ctx: PageContext,
  opts: ResolveOptions = {},
): string {
  return template.replace(TOKEN_RE, (_match, inner: string) => {
    const parts = inner.trim().split('|');
    const varName    = parts[0].trim();
    const filterDefs = parts.slice(1).map((f) => f.trim()).filter(Boolean);

    const value = lookupVar(varName, ctx);

    if (value === undefined) {
      opts.onUndefined?.(varName);
      return _match; // preserve original token
    }

    if (filterDefs.length > 0 && opts.applyFilters) {
      return opts.applyFilters(value, filterDefs);
    }

    return value;
  });
}
