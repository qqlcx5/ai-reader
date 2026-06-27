// ============================================================
// Page Metadata Parser for SuperBrain Content Extraction
// ============================================================

import type { PageMetadata } from '../../shared/domain';

/**
 * Extract page metadata using a priority chain:
 *   1. Open Graph tags (og:title, og:description, etc.)
 *   2. Schema.org JSON-LD (application/ld+json)
 *   3. HTML <meta> tags (description, author, etc.)
 *   4. Heuristic fallbacks (<title>, site name from URL)
 *
 * @param document - The page's Document object
 * @param url - The page URL
 * @returns Complete PageMetadata object
 */
export function extractPageMetadata(document: Document, url: string): PageMetadata {
  // Priority 1: Open Graph
  const og = extractOpenGraph(document);

  // Priority 2: Schema.org JSON-LD
  const jsonLd = extractSchemaOrg(document);

  // Priority 3: HTML meta tags
  const meta = extractHtmlMeta(document);

  // Priority 4: Heuristic fallbacks
  const heuristic = extractHeuristics(document, url);

  // Merge with priority chain
  return {
    title: og.title || jsonLd.title || meta.title || heuristic.title,
    url: url,
    siteName: og.siteName || jsonLd.siteName || meta.siteName || heuristic.siteName,
    author: og.author || jsonLd.author || meta.author || heuristic.author,
    publishedAt: og.publishedAt || jsonLd.publishedAt || meta.publishedAt || heuristic.publishedAt,
    description: og.description || jsonLd.description || meta.description || heuristic.description,
    faviconUrl: meta.faviconUrl || heuristic.faviconUrl,
    lang: og.lang || meta.lang || heuristic.lang,
  };
}

// ============================================================
// Priority 1: Open Graph Tags
// ============================================================

interface OgFields {
  title?: string;
  description?: string;
  siteName?: string;
  author?: string;
  publishedAt?: string;
  lang?: string;
  image?: string;
}

function extractOpenGraph(doc: Document): OgFields {
  const result: OgFields = {};

  const ogTitle = doc.querySelector('meta[property="og:title"]');
  if (ogTitle) result.title = ogTitle.getAttribute('content') ?? undefined;

  const ogDesc = doc.querySelector('meta[property="og:description"]');
  if (ogDesc) result.description = ogDesc.getAttribute('content') ?? undefined;

  const ogSite = doc.querySelector('meta[property="og:site_name"]');
  if (ogSite) result.siteName = ogSite.getAttribute('content') ?? undefined;

  const ogImage = doc.querySelector('meta[property="og:image"]');
  if (ogImage) result.image = ogImage.getAttribute('content') ?? undefined;

  // Open Graph article:author
  const ogAuthor = doc.querySelector('meta[property="article:author"]');
  if (ogAuthor) result.author = ogAuthor.getAttribute('content') ?? undefined;

  // Open Graph article:published_time
  const ogPublished = doc.querySelector('meta[property="article:published_time"]');
  if (ogPublished) result.publishedAt = ogPublished.getAttribute('content') ?? undefined;

  // Open Graph locale → lang
  const ogLocale = doc.querySelector('meta[property="og:locale"]');
  if (ogLocale) {
    const locale = ogLocale.getAttribute('content');
    if (locale) result.lang = locale.split('_')[0]; // zh_CN → zh
  }

  return result;
}

// ============================================================
// Priority 2: Schema.org JSON-LD
// ============================================================

interface JsonLdFields {
  title?: string;
  description?: string;
  siteName?: string;
  author?: string;
  publishedAt?: string;
}

function extractSchemaOrg(doc: Document): JsonLdFields {
  const result: JsonLdFields = {};

  const scripts = doc.querySelectorAll('script[type="application/ld+json"]');
  for (const script of scripts) {
    const json = tryParseJson(script.textContent ?? '');
    if (!json) continue;

    // Handle @graph structure
    const nodes: Record<string, unknown>[] = json['@graph'] ? json['@graph'] : [json];

    for (const node of nodes) {
      if (node['@type'] === 'WebSite') {
        result.siteName =
          (node.name as string) || result.siteName;
      }

      if (
        node['@type'] === 'Article' ||
        node['@type'] === 'BlogPosting' ||
        node['@type'] === 'NewsArticle'
      ) {
        result.title = (node.headline as string) || (node.name as string) || result.title;
        result.description =
          (node.description as string) || result.description;
        result.publishedAt =
          (node.datePublished as string) || result.publishedAt;

        // Author from Person object or string
        if (node.author) {
          if (typeof node.author === 'string') {
            result.author = node.author;
          } else if (typeof node.author === 'object' && node.author !== null) {
            result.author =
              (node.author as Record<string, unknown>).name as string;
          }
        }
      }
    }

    // If we found meaningful data, stop scanning
    if (result.title || result.siteName) break;
  }

  return result;
}

function tryParseJson(text: string): Record<string, unknown> | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// ============================================================
// Priority 3: HTML <meta> Tags
// ============================================================

interface MetaFields {
  title?: string;
  description?: string;
  siteName?: string;
  author?: string;
  publishedAt?: string;
  faviconUrl?: string;
  lang?: string;
}

function extractHtmlMeta(doc: Document): MetaFields {
  const result: MetaFields = {};

  // <title>
  result.title = doc.title || undefined;

  // meta[name="description"]
  const desc = doc.querySelector('meta[name="description"]');
  if (desc) result.description = desc.getAttribute('content') ?? undefined;

  // meta[name="author"]
  const author = doc.querySelector('meta[name="author"]');
  if (author) result.author = author.getAttribute('content') ?? undefined;

  // Twitter card: site → siteName
  const twitterSite = doc.querySelector('meta[name="twitter:site"]');
  if (twitterSite) {
    const content = twitterSite.getAttribute('content');
    if (content) result.siteName = content.replace(/^@/, '');
  }

  // meta[name="date"] or meta[name="published_at"]
  const dateMeta =
    doc.querySelector('meta[name="date"]') ??
    doc.querySelector('meta[name="published_at"]') ??
    doc.querySelector('meta[property="article:published_time"]');
  if (dateMeta) result.publishedAt = dateMeta.getAttribute('content') ?? undefined;

  // DC terms
  const dcDate = doc.querySelector('meta[name="DC.date"]') ??
    doc.querySelector('meta[name="dcterms.created"]');
  if (dcDate && !result.publishedAt) {
    result.publishedAt = dcDate.getAttribute('content') ?? undefined;
  }

  // Favicon
  result.faviconUrl = extractFaviconUrl(doc);

  // Lang from <html lang="">
  result.lang = doc.documentElement.lang || undefined;

  return result;
}

function extractFaviconUrl(doc: Document): string {
  // Standard link[rel="icon"]
  const iconLink =
    doc.querySelector('link[rel="icon"]') ??
    doc.querySelector('link[rel="shortcut icon"]') ??
    doc.querySelector('link[rel="apple-touch-icon"]') ??
    doc.querySelector('link[rel="apple-touch-icon-precomposed"]');

  if (iconLink) {
    const href = iconLink.getAttribute('href');
    if (href) return resolveUrl(href, doc);
  }

  // Fallback: /favicon.ico
  return resolveUrl('/favicon.ico', doc);
}

function resolveUrl(href: string, doc: Document): string {
  try {
    const base = doc.querySelector('base');
    const baseHref = base?.getAttribute('href') ?? doc.baseURI;
    return new URL(href, baseHref).href;
  } catch {
    return href;
  }
}

// ============================================================
// Priority 4: Heuristic Fallbacks
// ============================================================

interface HeuristicFields {
  title: string;
  description: string;
  siteName: string;
  author: string;
  publishedAt: string;
  faviconUrl: string;
  lang: string;
}

function extractHeuristics(doc: Document, url: string): HeuristicFields {
  return {
    title: doc.title || url,
    description: '',
    siteName: extractSiteNameFromUrl(url),
    author: '',
    publishedAt: '',
    faviconUrl: resolveUrl('/favicon.ico', doc),
    lang: doc.documentElement.lang || navigator.language || 'en',
  };
}

function extractSiteNameFromUrl(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    // Remove leading 'www.'
    const cleaned = hostname.replace(/^www\./, '');
    // Capitalize first letter
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  } catch {
    return '';
  }
}
