// ============================================================
// Tests: Markdown Generator – Frontmatter YAML
// ============================================================

import { describe, it, expect } from 'vitest';
import { buildFrontmatter, generateMarkdown, convertHtmlToMarkdown } from './markdown-generator';
import type { ExtractResult, PageMetadata } from '../../shared/domain';

const sampleExtractResult: ExtractResult = {
  title: 'Test Article',
  url: 'https://example.com/test-article',
  siteName: 'Example Blog',
  author: 'Jane Doe',
  publishedAt: '2025-06-15',
  excerpt: 'A test article about testing.',
  contentHtml: '<h1>Test Article</h1><p>This is the body content.</p>',
  contentText: 'Test Article\nThis is the body content.',
  image: 'https://example.com/img.jpg',
  readingTime: 3,
};

const sampleMetadata: PageMetadata = {
  title: 'OG Test Article',
  url: 'https://example.com/test-article',
  siteName: 'Example Blog',
  author: 'Jane Doe',
  publishedAt: '2025-06-15T10:00:00Z',
  description: 'A test article about testing.',
  faviconUrl: 'https://example.com/favicon.ico',
  lang: 'en',
};

describe('buildFrontmatter', () => {
  it('should produce valid YAML frontmatter with all fields', () => {
    const fm = buildFrontmatter(sampleExtractResult, sampleMetadata);

    expect(fm.startsWith('---\n')).toBe(true);
    expect(fm.endsWith('\n---')).toBe(true);
    expect(fm).toContain('title: "OG Test Article"');
    expect(fm).toContain('url: "https://example.com/test-article"');
    expect(fm).toContain('site_name: "Example Blog"');
    expect(fm).toContain('author: "Jane Doe"');
    expect(fm).toContain('published_at: "2025-06-15T10:00:00Z"');
    expect(fm).toContain('description: "A test article about testing."');
    expect(fm).toContain('image: "https://example.com/img.jpg"');
    expect(fm).toContain('favicon_url: "https://example.com/favicon.ico"');
    expect(fm).toContain('lang: "en"');
    expect(fm).toContain('reading_time: "3"');
    expect(fm).toContain('captured_at: "');
  });

  it('should omit empty fields', () => {
    const emptyExtract: ExtractResult = {
      ...sampleExtractResult,
      author: '',
      image: '',
      siteName: '',
      publishedAt: '',
      excerpt: '',
    };
    const emptyMeta: PageMetadata = {
      ...sampleMetadata,
      author: '',
      publishedAt: '',
      faviconUrl: '',
      description: '',
      lang: '',
    };

    const fm = buildFrontmatter(emptyExtract, emptyMeta);

    expect(fm).not.toContain('author:');
    expect(fm).not.toContain('published_at:');
    expect(fm).not.toContain('favicon_url:');
    expect(fm).not.toContain('lang:');
    expect(fm).not.toContain('description:');
    expect(fm).toContain('title:');
    expect(fm).toContain('url:');
    expect(fm).toContain('captured_at:');
  });

  it('should escape double quotes in YAML values', () => {
    const metaWithQuotes: PageMetadata = {
      ...sampleMetadata,
      title: 'Article with "quotes" inside',
    };

    const fm = buildFrontmatter(sampleExtractResult, metaWithQuotes);
    expect(fm).toContain('title: "Article with \\"quotes\\" inside"');
  });

  it('should use metadata title over extract result title', () => {
    const fm = buildFrontmatter(sampleExtractResult, sampleMetadata);
    // Metadata title "OG Test Article" should win over ExtractResult title "Test Article"
    expect(fm).toContain('title: "OG Test Article"');
    expect(fm).not.toContain('title: "Test Article"');
  });

  it('should fall back to extractResult when metadata is empty', () => {
    const partialMeta: PageMetadata = {
      ...sampleMetadata,
      title: '',
      author: '',
    };

    const fm = buildFrontmatter(sampleExtractResult, partialMeta);
    // Should fall back to extractResult
    expect(fm).toContain('title: "Test Article"');
  });
});

describe('generateMarkdown', () => {
  it('should combine frontmatter and body content', () => {
    const md = generateMarkdown(sampleExtractResult, sampleMetadata);

    expect(md.startsWith('---\n')).toBe(true);
    // Frontmatter ends with '---\n' followed by body content
    const secondSep = md.indexOf('---\n', 1);
    expect(secondSep).toBeGreaterThan(0);
    // Body content should follow
    expect(md.slice(secondSep + 4).trim().length).toBeGreaterThan(0);
  });

  it('should handle extractResult with only contentText (no contentHtml)', () => {
    const textOnly: ExtractResult = {
      ...sampleExtractResult,
      contentHtml: '',
      contentText: 'Plain text only.',
    };

    const md = generateMarkdown(textOnly, sampleMetadata);
    expect(md).toContain('Plain text only.');
  });
});

describe('convertHtmlToMarkdown', () => {
  it('should convert headings', () => {
    const md = convertHtmlToMarkdown('<h1>Title</h1><h2>Subtitle</h2>', '');
    expect(md).toContain('# Title');
    expect(md).toContain('## Subtitle');
  });

  it('should convert bold and italic', () => {
    const md = convertHtmlToMarkdown('<strong>Bold</strong> and <em>Italic</em>', '');
    expect(md).toContain('**Bold**');
    expect(md).toContain('*Italic*');
  });

  it('should convert links', () => {
    const md = convertHtmlToMarkdown(
      '<a href="https://example.com">Click here</a>',
      '',
    );
    expect(md).toContain('[Click here](https://example.com)');
  });

  it('should convert images', () => {
    const md = convertHtmlToMarkdown(
      '<img src="https://example.com/img.jpg" alt="Alt text">',
      '',
    );
    expect(md).toContain('![Alt text](https://example.com/img.jpg)');
  });

  it('should strip remaining HTML tags', () => {
    const md = convertHtmlToMarkdown(
      '<div class="wrapper"><span>Hello</span></div>',
      '',
    );
    expect(md).not.toContain('<div');
    expect(md).not.toContain('<span');
    expect(md).toContain('Hello');
  });

  it('should convert lists', () => {
    const md = convertHtmlToMarkdown(
      '<ul><li>Item 1</li><li>Item 2</li></ul>',
      '',
    );
    expect(md).toContain('- Item 1');
    expect(md).toContain('- Item 2');
  });

  it('should convert blockquotes', () => {
    const md = convertHtmlToMarkdown(
      '<blockquote>Quoted text</blockquote>',
      '',
    );
    expect(md).toContain('> Quoted text');
  });

  it('should normalize multiple newlines', () => {
    const md = convertHtmlToMarkdown('<p>A</p>\n<p>B</p>\n\n\n<p>C</p>', '');
    // Should not have 3+ consecutive newlines
    expect(md.match(/\n{3,}/)).toBeNull();
  });
});
