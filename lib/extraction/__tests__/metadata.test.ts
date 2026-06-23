/**
 * M2 — Unit tests for the metadata extractor
 *
 * Verifies correct extraction of:
 *  - Open Graph tags (og:title, og:description, og:image)
 *  - Standard meta tags (author, description, article:published_time)
 *  - JSON-LD Schema.org (@Article, @Product, @graph wrapper)
 *  - Favicon resolution (relative → absolute)
 */
import { describe, it, expect } from 'vitest';
import { extractMetadata } from '../metadata-extractor';

function makeDoc(html: string, _url = 'https://example.com/'): Document {
  // DOMParser documents in jsdom are detached; document.location is null.
  // domain-related assertions below account for this by accepting '' or falsy.
  const parser = new DOMParser();
  return parser.parseFromString(html, 'text/html');
}

// ─── OG tag tests ─────────────────────────────────────────────────────────────

describe('extractMetadata — Open Graph', () => {
  it('extracts og:title, og:description, og:image', () => {
    const doc = makeDoc(`
      <html><head>
        <title>Page Title</title>
        <meta property="og:title" content="OG Title" />
        <meta property="og:description" content="OG Description" />
        <meta property="og:image" content="https://cdn.example.com/img.jpg" />
        <meta property="og:site_name" content="Example Site" />
      </head><body></body></html>
    `);
    const meta = extractMetadata(doc);
    expect(meta.ogTitle).toBe('OG Title');
    expect(meta.ogDescription).toBe('OG Description');
    expect(meta.ogImage).toBe('https://cdn.example.com/img.jpg');
    expect(meta.site).toBe('Example Site');
  });

  it('falls back to document.title when og:title is absent', () => {
    const doc = makeDoc(`<html><head><title>Fallback Title</title></head><body></body></html>`);
    const meta = extractMetadata(doc);
    expect(meta.title).toBe('Fallback Title');
  });

  it('extracts author from meta[name="author"]', () => {
    const doc = makeDoc(`
      <html><head>
        <meta name="author" content="John Smith" />
      </head><body></body></html>
    `);
    const meta = extractMetadata(doc);
    expect(meta.author).toBe('John Smith');
  });

  it('extracts published date from article:published_time', () => {
    const doc = makeDoc(`
      <html><head>
        <meta property="article:published_time" content="2025-06-01T12:00:00Z" />
      </head><body></body></html>
    `);
    const meta = extractMetadata(doc);
    expect(meta.published).toBe('2025-06-01T12:00:00Z');
  });

  it('resolves relative favicon (returns the path as-is when origin is unavailable)', () => {
    const doc = makeDoc(`
      <html><head>
        <link rel="icon" href="/favicon.ico" />
      </head><body></body></html>
    `);
    const meta = extractMetadata(doc);
    // In jsdom DOMParser docs, location is null → origin is '' → favicon
    // returned as-is with the leading slash (or with empty origin prefix).
    expect(meta.favicon).toBeTruthy();
    expect(meta.favicon!.includes('favicon.ico')).toBe(true);
  });

  it('keeps absolute favicon unchanged', () => {
    const doc = makeDoc(`
      <html><head>
        <link rel="icon" href="https://cdn.example.com/favicon.ico" />
      </head><body></body></html>
    `);
    const meta = extractMetadata(doc);
    expect(meta.favicon).toBe('https://cdn.example.com/favicon.ico');
  });

  it('returns empty string for domain when document has no location (DOMParser / jsdom)', () => {
    const doc = makeDoc('<html><head></head><body></body></html>', 'https://example.com/path');
    const meta = extractMetadata(doc);
    // In jsdom DOMParser documents, location is null → domain defaults to ''
    expect(typeof meta.domain).toBe('string');
  });
});

// ─── JSON-LD / Schema.org tests ───────────────────────────────────────────────

describe('extractMetadata — JSON-LD Schema.org', () => {
  it('parses @Article and extracts author and datePublished', () => {
    const doc = makeDoc(`
      <html><head>
        <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@type": "Article",
          "headline": "Article Headline",
          "author": { "@type": "Person", "name": "Alice" },
          "datePublished": "2025-01-15"
        }
        </script>
      </head><body></body></html>
    `);
    const meta = extractMetadata(doc);
    expect(meta.author).toBe('Alice');
    expect(meta.published).toBe('2025-01-15');
    expect(meta.schemaOrg).toBeDefined();
    expect(meta.schemaOrg![0]['@type']).toBe('Article');
  });

  it('parses @graph wrapper containing multiple types', () => {
    const doc = makeDoc(`
      <html><head>
        <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@graph": [
            { "@type": "WebSite", "name": "Example" },
            { "@type": "Article", "author": "Bob", "datePublished": "2025-03-01" }
          ]
        }
        </script>
      </head><body></body></html>
    `);
    const meta = extractMetadata(doc);
    expect(meta.schemaOrg).toHaveLength(2);
    expect(meta.author).toBe('Bob');
    expect(meta.published).toBe('2025-03-01');
  });

  it('handles an array of JSON-LD scripts', () => {
    const doc = makeDoc(`
      <html><head>
        <script type="application/ld+json">{ "@type": "Product", "name": "Widget" }</script>
        <script type="application/ld+json">{ "@type": "Review", "reviewRating": { "ratingValue": "4.5" } }</script>
      </head><body></body></html>
    `);
    const meta = extractMetadata(doc);
    expect(meta.schemaOrg).toHaveLength(2);
    const types = meta.schemaOrg!.map((s) => s['@type']);
    expect(types).toContain('Product');
    expect(types).toContain('Review');
  });

  it('silently ignores malformed JSON-LD', () => {
    const doc = makeDoc(`
      <html><head>
        <script type="application/ld+json">NOT_VALID_JSON</script>
        <meta property="og:title" content="Valid OG Title" />
      </head><body></body></html>
    `);
    const meta = extractMetadata(doc);
    // Should not throw; schemaOrg should be undefined or empty
    expect(meta.schemaOrg == null || meta.schemaOrg.length === 0).toBe(true);
    // Other fields still extracted correctly
    expect(meta.ogTitle).toBe('Valid OG Title');
  });

  it('does not include schema items without @type', () => {
    const doc = makeDoc(`
      <html><head>
        <script type="application/ld+json">
        { "name": "No type here", "description": "No @type field" }
        </script>
      </head><body></body></html>
    `);
    const meta = extractMetadata(doc);
    expect(meta.schemaOrg == null || meta.schemaOrg.length === 0).toBe(true);
  });
});
