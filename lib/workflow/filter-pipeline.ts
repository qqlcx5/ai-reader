/**
 * M5 — Filter Pipeline (Filter 管道解析器).
 *
 * Parses `filter1|filter2(arg1,arg2)` token arrays and executes them in order.
 * Unknown filter names throw a compile-time FilterError.
 * No eval() or Function() — uses the FILTERS whitelist from filters.ts.
 */

import { FILTERS, FILTER_NAMES, type FilterFn } from './filters';

export class FilterError extends Error {
  constructor(message: string, public readonly filterName?: string) {
    super(message);
    this.name = 'FilterError';
  }
}

export interface ParsedFilter {
  name: string;
  args: string[];
}

/**
 * Parse a single filter token like "replace(foo,bar)" into name + args.
 *
 * Supported token forms:
 *  - "trim"            → { name: "trim", args: [] }
 *  - "truncate(120)"   → { name: "truncate", args: ["120"] }
 *  - "replace(a,b)"    → { name: "replace", args: ["a", "b"] }
 *  - "callout(warning)" → { name: "callout", args: ["warning"] }
 */
export function parseFilterToken(token: string): ParsedFilter {
  const parenIdx = token.indexOf('(');
  if (parenIdx === -1) {
    return { name: token.trim(), args: [] };
  }
  const name = token.slice(0, parenIdx).trim();
  const argsRaw = token.slice(parenIdx + 1, token.lastIndexOf(')')).trim();
  // Split args by comma, but respect quoted strings (simple implementation).
  const args = argsRaw
    ? argsRaw.split(',').map((a) => a.trim().replace(/^['"]|['"]$/g, ''))
    : [];
  return { name, args };
}

/**
 * Parse an array of raw filter tokens and validate each name against the
 * whitelist. Throws `FilterError` if an unknown filter is encountered
 * (compile-time check).
 */
export function parseFilters(tokens: string[]): ParsedFilter[] {
  return tokens.map((token) => {
    const parsed = parseFilterToken(token);
    if (!FILTER_NAMES.has(parsed.name)) {
      throw new FilterError(
        `Unknown filter: "${parsed.name}". Allowed filters: ${[...FILTER_NAMES].join(', ')}`,
        parsed.name,
      );
    }
    return parsed;
  });
}

/**
 * Apply a parsed filter chain to an initial string value.
 *
 * Throws `FilterError` for unknown filters (should already be caught at
 * parse time, but guarded here as well).
 */
export function applyFilterChain(value: string, filters: ParsedFilter[]): string {
  let result = value;
  for (const f of filters) {
    const fn = FILTERS[f.name] as FilterFn | undefined;
    if (!fn) {
      throw new FilterError(`Unknown filter at runtime: "${f.name}"`, f.name);
    }
    result = fn(result, ...f.args);
  }
  return result;
}

/**
 * High-level helper: parse raw filter token strings and apply them.
 *
 * This is the function injected into `resolveVariables` as `applyFilters`.
 *
 * @param value  - the resolved variable value
 * @param tokens - raw filter tokens from the template, e.g. ["trim", "upper"]
 */
export function runFilterPipeline(value: string, tokens: string[]): string {
  const parsed = parseFilters(tokens);
  return applyFilterChain(value, parsed);
}
