// ============================================================
// Tests: Page Metadata Parser – Priority Chain
// ============================================================

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { extractPageMetadata } from './metadata-parser';

function setupDoc(html: string): Document {
  document.documentElement.innerHTML = html;
  return document;
}

describe('extractPageMetadata – priority chain', () => {
  const TEST_URL = 'https://example.com/blog/post-1';

  afterEach(() => {
    document.documentElement.innerHTML = '';
  });

  // ============================================================
  // Priority 1: Open Graph (highest priority)
  // ============================================================

  it('should extract title from og:title (OG priority)', () => {
    const doc = setupDoc(`
      <head>
        <title>HTML Title</title>
        <meta property="og:title" content="OG Title">
        <meta name="description" content="Meta description">
      </head>
    `);

    const meta = extractPageMetadata(doc, TEST_URL);
    expect(meta.title).toBe('OG Title');
  });

  it('should extract description from og:description', () => {
    const doc = setupDoc(`
      <head>
        <meta property="og:description" content="OG description text">
        <meta name="description" content="Meta description">
      </head>
    `);

    const meta = extractPageMetadata(doc, TEST_URL);
    expect(meta.description).toBe('OG description text');
  });

  it('should extract siteName from og:site_name', () => {
    const doc = setupDoc(`
      <head>
        <meta property="og:site_name" content="Example Blog">
      </head>
    `);

    const meta = extractPageMetadata(doc, TEST_URL);
    expect(meta.siteName).toBe('Example Blog');
  });

  it('should extract author from article:author (OG)', () => {
    const doc = setupDoc(`
      <head>
        <meta property="article:author" content="Jane Doe">
      </head>
    `);

    const meta = extractPageMetadata(doc, TEST_URL);
    expect(meta.author).toBe('Jane Doe');
  });

  it('should extract publishedAt from article:published_time', () => {
    const doc = setupDoc(`
      <head>
        <meta property="article:published_time" content="2025-06-15T10:00:00Z">
      </head>
    `);

    const meta = extractPageMetadata(doc, TEST_URL);
    expect(meta.publishedAt).toBe('2025-06-15T10:00:00Z');
  });

  it('should extract lang from og:locale', () => {
    const doc = setupDoc(`
      <head>
        <meta property="og:locale" content="zh_CN">
      </head>
    `);

    const meta = extractPageMetadata(doc, TEST_URL);
    expect(meta.lang).toBe('zh');
  });

  // ============================================================
  // Priority 2: Schema.org JSON-LD
  // ============================================================

  it('should fall back to JSON-LD when OG is missing', () => {
    const doc = setupDoc(`
      <head>
        <title>HTML Fallback</title>
        <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@type": "Article",
          "headline": "JSON-LD Title",
          "description": "JSON-LD Description",
          "author": { "@type": "Person", "name": "John Smith" },
          "datePublished": "2025-05-01"
        }
        </script>
      </head>
    `);

    const meta = extractPageMetadata(doc, TEST_URL);
    expect(meta.title).toBe('JSON-LD Title');
    expect(meta.description).toBe('JSON-LD Description');
    expect(meta.author).toBe('John Smith');
    expect(meta.publishedAt).toBe('2025-05-01');
  });

  it('should extract siteName from JSON-LD WebSite type', () => {
    const doc = setupDoc(`
      <head>
        <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@type": "WebSite",
          "name": "My Awesome Site"
        }
        </script>
      </head>
    `);

    const meta = extractPageMetadata(doc, TEST_URL);
    expect(meta.siteName).toBe('My Awesome Site');
  });

  it('should handle JSON-LD @graph structure', () => {
    const doc = setupDoc(`
      <head>
        <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@graph": [
            { "@type": "WebSite", "name": "Graph Site" },
            { "@type": "Article", "headline": "Graph Article", "author": "Alice" }
          ]
        }
        </script>
      </head>
    `);

    const meta = extractPageMetadata(doc, TEST_URL);
    expect(meta.siteName).toBe('Graph Site');
    expect(meta.title).toBe('Graph Article');
  });

  // ============================================================
  // Priority 3: HTML Meta Tags
  // ============================================================

  it('should fall back to HTML meta when OG and JSON-LD are missing', () => {
    const doc = setupDoc(`
      <head>
        <title>HTML Title</title>
        <meta name="description" content="HTML Meta Description">
        <meta name="author" content="Meta Author">
      </head>
    `);

    const meta = extractPageMetadata(doc, TEST_URL);
    expect(meta.title).toBe('HTML Title');
    expect(meta.description).toBe('HTML Meta Description');
    expect(meta.author).toBe('Meta Author');
  });

  it('should extract lang from <html lang> attribute', () => {
    const doc = setupDoc(`
      <head><title>Test</title></head>
    `);
    doc.documentElement.setAttribute('lang', 'de');

    const meta = extractPageMetadata(doc, TEST_URL);
    expect(meta.lang).toBe('de');
  });

  // ============================================================
  // Priority 4: Heuristic Fallbacks
  // ============================================================

  it('should derive siteName from URL hostname', () => {
    const doc = setupDoc(`<head><title>Test</title></head>`);

    const meta = extractPageMetadata(doc, 'https://www.github.com/user/repo');
    expect(meta.siteName).toBe('Github.com');
  });

  it('should derive siteName from URL without www prefix', () => {
    const doc = setupDoc(`<head><title>Test</title></head>`);

    const meta = extractPageMetadata(doc, 'https://blog.example.com/posts/1');
    expect(meta.siteName).toBe('Blog.example.com');
  });

  it('should return a complete metadata object even with minimal HTML', () => {
    const doc = setupDoc(`
      <head></head><body></body>
    `);

    const meta = extractPageMetadata(doc, TEST_URL);
    expect(meta.title).toBe(TEST_URL);
    expect(meta.url).toBe(TEST_URL);
    expect(meta.siteName).toBe('Example.com');
    expect(meta.lang).toBeTruthy();
    expect(meta.faviconUrl).toBeTruthy();
  });

  // ============================================================
  // OG overrides JSON-LD (priority verification)
  // ============================================================

  it('should prefer OG over JSON-LD when both are present', () => {
    const doc = setupDoc(`
      <head>
        <meta property="og:title" content="OG Wins">
        <meta property="og:description" content="OG Desc Wins">
        <meta property="article:author" content="OG Author">
        <meta property="article:published_time" content="2025-06-01">
        <meta property="og:site_name" content="OG Site">
        <script type="application/ld+json">
        {
          "@type": "Article",
          "headline": "JSON-LD Loses",
          "description": "JSON-LD Desc",
          "author": "LD Author",
          "datePublished": "2025-01-01"
        }
        </script>
        <script type="application/ld+json">
        { "@type": "WebSite", "name": "LD Site" }
        </script>
      </head>
    `);

    const meta = extractPageMetadata(doc, TEST_URL);
    expect(meta.title).toBe('OG Wins');
    expect(meta.description).toBe('OG Desc Wins');
    expect(meta.author).toBe('OG Author');
    expect(meta.publishedAt).toBe('2025-06-01');
    expect(meta.siteName).toBe('OG Site');
  });

  // ============================================================
  // Favicon extraction
  // ============================================================

  it('should extract favicon from link[rel="icon"]', () => {
    const doc = setupDoc(`
      <head>
        <base href="https://example.com/">
        <title>Test</title>
        <link rel="icon" href="/custom-favicon.png">
      </head>
    `);

    const meta = extractPageMetadata(doc, TEST_URL);
    expect(meta.faviconUrl).toBe('https://example.com/custom-favicon.png');
  });

  it('should fall back to /favicon.ico', () => {
    const doc = setupDoc(`
      <head>
        <base href="https://example.com/">
        <title>Test</title>
      </head>
    `);

    const meta = extractPageMetadata(doc, TEST_URL);
    expect(meta.faviconUrl).toBe('https://example.com/favicon.ico');
  });
});
