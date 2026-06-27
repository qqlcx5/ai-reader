// ============================================================
// obsidian-exporter.test.ts — Obsidian export unit tests
// ============================================================

import { describe, it, expect } from 'vitest';
import {
  exportArticleObsidian,
  sanitizeFilename,
  buildFrontmatter,
  renderYamlFrontmatter,
  formatDate,
} from './obsidian-exporter';
import type { SavedArticle } from '../../shared/domain';

function makeArticle(overrides: Partial<SavedArticle> = {}): SavedArticle {
  return {
    id: 'art-001',
    title: '深度学习入门指南',
    url: 'https://example.com/deep-learning',
    siteName: 'Example Blog',
    author: '张三',
    publishedAt: '2026-06-20T08:00:00Z',
    excerpt: '一篇关于深度学习的入门文章',
    markdown: '## 什么是深度学习\n\n深度学习是机器学习的一个分支。\n\n## 神经网络基础\n\n神经网络由多个层组成。',
    contentHtml: '',
    contentText: '什么是深度学习\n\n深度学习是机器学习的一个分支。\n\n神经网络由多个层组成。',
    faviconUrl: '',
    image: '',
    readingTime: 5,
    createdAt: '2026-06-27T10:00:00Z',
    updatedAt: '2026-06-27T10:00:00Z',
    ...overrides,
  };
}

// ---- sanitizeFilename ----

describe('sanitizeFilename', () => {
  it('returns a safe filename for a normal title', () => {
    expect(sanitizeFilename('深度学习入门指南')).toBe('深度学习入门指南');
  });

  it('strips illegal characters: < > : " / \\ | ? *', () => {
    const dirty = 'test<file>:name?*';
    expect(sanitizeFilename(dirty)).toBe('testfilename');
  });

  it('collapses multiple spaces', () => {
    expect(sanitizeFilename('Hello   World')).toBe('Hello World');
  });

  it('trims leading and trailing whitespace', () => {
    expect(sanitizeFilename('  title  ')).toBe('title');
  });

  it('truncates to 200 characters', () => {
    const long = 'a'.repeat(300);
    const result = sanitizeFilename(long);
    expect(result.length).toBeLessThanOrEqual(200);
    expect(result).toBe('a'.repeat(200));
  });

  it('handles empty string', () => {
    expect(sanitizeFilename('')).toBe('');
  });

  it('removes control characters', () => {
    expect(sanitizeFilename('hello\x00world')).toBe('helloworld');
  });
});

// ---- formatDate ----

describe('formatDate', () => {
  it('formats ISO date to YYYY-MM-DD', () => {
    expect(formatDate('2026-06-27T10:00:00Z')).toBe('2026-06-27');
  });

  it('formats date-only string', () => {
    expect(formatDate('2026-01-01')).toBe('2026-01-01');
  });

  it('returns first 10 chars for unknown formats', () => {
    expect(formatDate('not-a-date-xyz')).toBe('not-a-date');
  });
});

// ---- renderYamlFrontmatter ----

describe('renderYamlFrontmatter', () => {
  it('renders string fields correctly', () => {
    const fm = { title: 'Test', author: 'Alice' };
    const yaml = renderYamlFrontmatter(fm);
    expect(yaml).toContain('---');
    expect(yaml).toContain('title: "Test"');
    expect(yaml).toContain('author: "Alice"');
  });

  it('renders array fields as YAML list', () => {
    const fm = { tags: ['ai', 'deep-learning'] };
    const yaml = renderYamlFrontmatter(fm);
    expect(yaml).toContain('tags:');
    expect(yaml).toContain('  - "ai"');
    expect(yaml).toContain('  - "deep-learning"');
  });

  it('renders empty array as []', () => {
    const fm = { tags: [] as string[] };
    const yaml = renderYamlFrontmatter(fm);
    expect(yaml).toContain('tags: []');
  });

  it('skips null and undefined values', () => {
    const fm = { title: 'Test', author: undefined, description: null as unknown };
    const yaml = renderYamlFrontmatter(fm);
    expect(yaml).toContain('title: "Test"');
    expect(yaml).not.toContain('author');
    expect(yaml).not.toContain('description');
  });

  it('renders number values without quotes', () => {
    const fm = { reading_time: 5 };
    const yaml = renderYamlFrontmatter(fm);
    expect(yaml).toContain('reading_time: 5');
  });

  it('escapes double quotes in values', () => {
    const fm = { title: 'He said "hello"' };
    const yaml = renderYamlFrontmatter(fm);
    expect(yaml).toContain('title: "He said \\"hello\\""');
  });
});

// ---- buildFrontmatter ----

describe('buildFrontmatter', () => {
  it('includes all standard fields', () => {
    const article = makeArticle();
    const fm = buildFrontmatter(article);
    expect(fm.title).toBe('深度学习入门指南');
    expect(fm.source).toBe('https://example.com/deep-learning');
    expect(fm.author).toBe('张三');
    expect(fm.site_name).toBe('Example Blog');
    expect(fm.excerpt).toBe('一篇关于深度学习的入门文章');
    expect(fm.reading_time).toBe(5);
  });

  it('includes tags when provided', () => {
    const article = makeArticle({} as any);
    const fm = buildFrontmatter(article, { tags: ['ai', 'ml'] });
    expect(fm.tags).toEqual(['ai', 'ml']);
  });

  it('omits tags when empty', () => {
    const article = makeArticle();
    const fm = buildFrontmatter(article);
    expect(fm.tags).toBeUndefined();
  });

  it('adds developer variant fields', () => {
    const article = makeArticle();
    const fm = buildFrontmatter(article, { variant: 'developer' });
    expect(fm.id).toBe('art-001');
    expect(fm.updated_at).toBe('2026-06-27T10:00:00Z');
    expect(fm.word_count).toBeGreaterThan(0);
  });

  it('adds business variant fields', () => {
    const article = makeArticle();
    const fm = buildFrontmatter(article, { variant: 'business' });
    expect(fm.captured_at).toBe('2026-06-27T10:00:00Z');
    expect(fm.document_type).toBe('web-clip');
  });

  it('merges extra frontmatter fields', () => {
    const article = makeArticle();
    const fm = buildFrontmatter(article, { extraFrontmatter: { custom_field: 'value', version: '1.0' } });
    expect(fm.custom_field).toBe('value');
    expect(fm.version).toBe('1.0');
  });

  it('uses createdAt for date when available', () => {
    const article = makeArticle();
    const fm = buildFrontmatter(article);
    expect(fm.created).toBe('2026-06-27');
  });

  it('falls back to publishedAt when no createdAt', () => {
    const article = makeArticle({ createdAt: '' });
    const fm = buildFrontmatter(article);
    expect(fm.created).toBe('2026-06-20');
  });

  it('omits optional fields when empty', () => {
    const article = makeArticle({ author: '', siteName: '', excerpt: '' });
    const fm = buildFrontmatter(article);
    expect(fm.author).toBeUndefined();
    expect(fm.site_name).toBeUndefined();
    expect(fm.excerpt).toBeUndefined();
  });
});

// ---- exportArticleObsidian ----

describe('exportArticleObsidian', () => {
  it('generates a complete Obsidian markdown file', () => {
    const article = makeArticle();
    const result = exportArticleObsidian(article);

    expect(result.filename).toBe('深度学习入门指南.md');
    expect(result.content).toContain('---');
    expect(result.content).toContain('title: "深度学习入门指南"');
    expect(result.content).toContain('source: "https://example.com/deep-learning"');
    expect(result.content).toContain('created: "2026-06-27"');
    expect(result.content).toContain('## 什么是深度学习');
    expect(result.content).toContain('## 神经网络基础');
    expect(result.frontmatter.title).toBe('深度学习入门指南');
  });

  it('applies variant through options', () => {
    const article = makeArticle();
    const result = exportArticleObsidian(article, { variant: 'developer' });
    expect(result.frontmatter.id).toBe('art-001');
  });

  it('uses custom tags', () => {
    const article = makeArticle();
    const result = exportArticleObsidian(article, { tags: ['tag1', 'tag2'] });
    expect(Array.isArray(result.frontmatter.tags)).toBe(true);
    expect((result.frontmatter.tags as string[])).toEqual(['tag1', 'tag2']);
  });

  it('sanitizes filename from title', () => {
    const article = makeArticle({ title: 'Test: <bad>/chars?' });
    const result = exportArticleObsidian(article);
    expect(result.filename).toBe('Test badchars.md');
  });
});
