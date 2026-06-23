/**
 * M2 — Structured metadata extractor
 *
 * Extracts page metadata from:
 *  1. Standard <meta> tags (title, author, description, published)
 *  2. Open Graph protocol (og:title, og:description, og:image, og:site_name)
 *  3. JSON-LD Schema.org (<script type="application/ld+json">)
 *     — supports @Article, @Recipe, @Product and @graph wrappers
 *
 * The result is merged with engine-level metadata inside the orchestrator.
 */
import type { PageMetadata, SchemaOrgData } from './types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getMeta(doc: Document, ...selectors: string[]): string | undefined {
  for (const sel of selectors) {
    const el =
      doc.querySelector(`meta[property="${sel}"]`) ??
      doc.querySelector(`meta[name="${sel}"]`);
    const content = el?.getAttribute('content');
    if (content) return content;
  }
  return undefined;
}

function getLinkHref(doc: Document, rel: string): string | undefined {
  return doc.querySelector(`link[rel="${rel}"]`)?.getAttribute('href') ?? undefined;
}

function absoluteUrl(href: string | undefined, doc: Document): string | undefined {
  if (!href) return undefined;
  if (/^https?:\/\//.test(href)) return href;
  try {
    const origin = (doc.location as Location | undefined)?.origin ?? '';
    return origin + (href.startsWith('/') ? href : `/${href}`);
  } catch {
    return href;
  }
}

// ─── JSON-LD parsing ──────────────────────────────────────────────────────────

function parseJsonLd(doc: Document): SchemaOrgData[] {
  const results: SchemaOrgData[] = [];
  doc.querySelectorAll('script[type="application/ld+json"]').forEach((script) => {
    try {
      const raw: unknown = JSON.parse(script.textContent ?? '{}');
      const items: unknown[] = Array.isArray(raw)
        ? raw
        : (raw as any)?.['@graph']
          ? (raw as any)['@graph']
          : [raw];
      for (const item of items) {
        if (item && typeof item === 'object' && (item as any)['@type']) {
          results.push(item as SchemaOrgData);
        }
      }
    } catch {
      // Silently ignore malformed JSON-LD
    }
  });
  return results;
}

/** Extract a plain string value from a Schema.org field (handles nested {name:…} objects). */
function schemaString(items: SchemaOrgData[], field: string): string | undefined {
  for (const item of items) {
    const val = item[field];
    if (typeof val === 'string' && val) return val;
    if (Array.isArray(val) && val.length > 0) {
      const first = val[0];
      if (typeof first === 'string') return first;
      if (typeof first?.name === 'string') return first.name;
    }
    if (val && typeof val === 'object' && typeof (val as any).name === 'string') {
      return (val as any).name;
    }
  }
  return undefined;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Extract structured metadata from the given Document.
 * Does not mutate the document.
 */
export function extractMetadata(doc: Document): PageMetadata {
  const schemaOrg = parseJsonLd(doc);

  // Open Graph / Twitter Card
  const ogTitle = getMeta(doc, 'og:title', 'twitter:title');
  const ogDescription = getMeta(doc, 'og:description', 'twitter:description');
  const ogImage = getMeta(doc, 'og:image', 'twitter:image');
  const ogSite = getMeta(doc, 'og:site_name');

  // Favicon
  const rawFavicon =
    getLinkHref(doc, 'icon') ??
    getLinkHref(doc, 'shortcut icon') ??
    getLinkHref(doc, 'apple-touch-icon');
  const favicon = absoluteUrl(rawFavicon, doc);

  // Author: try meta[name="author"] → Schema.org author → article:author
  const author =
    getMeta(doc, 'author') ??
    schemaString(schemaOrg, 'author') ??
    getMeta(doc, 'article:author') ??
    undefined;

  // Published date
  const published =
    getMeta(doc, 'article:published_time', 'article:modified_time', 'datePublished') ??
    schemaString(schemaOrg, 'datePublished') ??
    schemaString(schemaOrg, 'dateCreated') ??
    undefined;

  // Description
  const description =
    ogDescription ??
    getMeta(doc, 'description') ??
    schemaString(schemaOrg, 'description') ??
    undefined;

  const domain = (doc.location as Location | undefined)?.hostname ?? '';
  const site = ogSite ?? schemaString(schemaOrg, 'publisher') ?? domain;
  const title = ogTitle ?? doc.title ?? '';
  const image = absoluteUrl(ogImage, doc);

  return {
    title,
    author,
    description,
    published,
    site,
    domain,
    favicon,
    image,
    ogTitle: ogTitle ?? undefined,
    ogDescription: ogDescription ?? undefined,
    ogImage: ogImage ?? undefined,
    schemaOrg: schemaOrg.length > 0 ? schemaOrg : undefined,
  };
}
