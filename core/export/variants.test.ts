// ============================================================
// variants.test.ts — variant system unit tests
// ============================================================

import { describe, it, expect } from 'vitest';
import { listVariants, getVariantExporter, hasVariant } from './variants';
import type { SavedArticle } from '../../shared/domain';

function makeArticle(): SavedArticle {
  return {
    id: 'art-var',
    title: 'Variant Test Article',
    url: 'https://example.com/variant',
    siteName: 'Test Site',
    author: 'Tester',
    publishedAt: '2026-06-20T08:00:00Z',
    excerpt: 'Testing variant exports.',
    markdown: '# Variant Test\n\nSome content.\n\n```js\nconsole.log("hello");\n```',
    contentHtml: '',
    contentText: 'Variant Test\n\nSome content.\n\nconsole.log("hello");',
    faviconUrl: '',
    image: '',
    readingTime: 2,
    createdAt: '2026-06-27T12:00:00Z',
    updatedAt: '2026-06-27T12:00:00Z',
  };
}

describe('listVariants', () => {
  it('returns at least the 3 core variants', () => {
    const variants = listVariants();
    const ids = variants.map((v) => v.id);
    expect(ids).toContain('default');
    expect(ids).toContain('developer');
    expect(ids).toContain('business');
  });

  it('each variant has required meta fields', () => {
    for (const v of listVariants()) {
      expect(v.id).toBeTruthy();
      expect(v.name).toBeTruthy();
      expect(v.description).toBeTruthy();
    }
  });
});

describe('getVariantExporter', () => {
  const article = makeArticle();

  it('default variant produces standard markdown', () => {
    const exporter = getVariantExporter('default');
    const result = exporter(article, { variant: 'default' });
    expect(result.filename).toContain('.md');
    expect(result.content).toContain('---');
    expect(result.content).toContain('title: "Variant Test Article"');
    expect(result.content).toContain('# Variant Test');
  });

  it('developer variant includes extended metadata', () => {
    const exporter = getVariantExporter('developer');
    const result = exporter(article, { variant: 'developer' });

    // Should have ID and word count
    expect(result.frontmatter.id).toBe('art-var');
    expect(result.frontmatter.word_count).toBeGreaterThan(0);

    // Should have metadata footer
    expect(result.content).toContain('## 文件元信息');
    expect(result.content).toContain('art-var');
  });

  it('business variant includes header block', () => {
    const exporter = getVariantExporter('business');
    const result = exporter(article, { variant: 'business' });

    // Should have document_type
    expect(result.frontmatter.document_type).toBe('web-clip');

    // Should have business header
    expect(result.content).toContain('> **来源**: [Test Site](https://example.com/variant)');
    expect(result.content).toContain('> **作者**: Tester');
  });

  it('falls back to default for unknown variant', () => {
    const exporter = getVariantExporter('nonexistent');
    const result = exporter(article, { variant: 'nonexistent' });
    expect(result.filename).toContain('.md');
    expect(result.content).toContain('---');
  });

  it('default and developer produce different outputs', () => {
    const defExporter = getVariantExporter('default');
    const devExporter = getVariantExporter('developer');
    const defResult = defExporter(article, { variant: 'default' });
    const devResult = devExporter(article, { variant: 'developer' });

    expect(defResult.content).not.toBe(devResult.content);
    expect(devResult.content.length).toBeGreaterThan(defResult.content.length);
  });
});

describe('hasVariant', () => {
  it('returns true for registered variants', () => {
    expect(hasVariant('default')).toBe(true);
    expect(hasVariant('developer')).toBe(true);
    expect(hasVariant('business')).toBe(true);
  });

  it('returns false for unregistered variants', () => {
    expect(hasVariant('unknown')).toBe(false);
    expect(hasVariant('')).toBe(false);
  });
});
