// ============================================================
// mindmap-exporter.test.ts — MDX / JSON export unit tests
// ============================================================

import { describe, it, expect } from 'vitest';
import {
  exportMindMap,
  exportMindMapJson,
  exportMindMapMdx,
  parseHeadings,
} from './mindmap-exporter';
import type { SavedArticle } from '../../shared/domain';

function makeArticle(overrides: Partial<SavedArticle> = {}): SavedArticle {
  return {
    id: 'art-002',
    title: 'React 18 新特性',
    url: 'https://example.com/react-18',
    siteName: 'React Blog',
    author: '李四',
    publishedAt: '2026-06-15T08:00:00Z',
    excerpt: 'React 18 带来了并发特性和自动批处理。',
    markdown: '## 并发模式\n\nReact 18 引入了并发模式。\n\n### Suspense 改进\n\nSuspense 现在支持服务端渲染。\n\n## 自动批处理\n\n自动批处理减少了不必要的重渲染。',
    contentHtml: '',
    contentText: '并发模式\n\nReact 18 引入了并发模式。\n\n自动批处理减少了不必要的重渲染。',
    faviconUrl: '',
    image: '',
    readingTime: 3,
    createdAt: '2026-06-27T11:00:00Z',
    updatedAt: '2026-06-27T11:00:00Z',
    ...overrides,
  };
}

// ---- exportMindMapJson ----

describe('exportMindMapJson', () => {
  it('produces valid JSON', () => {
    const article = makeArticle();
    const json = exportMindMapJson(article);
    const parsed = JSON.parse(json);
    expect(parsed.id).toBe('art-002');
    expect(parsed.title).toBe('React 18 新特性');
    expect(parsed.sourceUrl).toBe('https://example.com/react-18');
    expect(parsed.summary).toBe('React 18 带来了并发特性和自动批处理。');
    expect(parsed.content).toContain('并发模式');
  });

  it('includes tags when available', () => {
    const article = makeArticle();
    (article as any).tags = ['react', 'frontend'];
    const json = exportMindMapJson(article);
    const parsed = JSON.parse(json);
    expect(parsed.tags).toEqual(['react', 'frontend']);
  });

  it('includes aiAnalysis when available', () => {
    const article = makeArticle();
    (article as any).aiSummary = 'React 18 的核心改进是并发渲染。';
    const json = exportMindMapJson(article);
    const parsed = JSON.parse(json);
    expect(parsed.aiAnalysis).toBe('React 18 的核心改进是并发渲染。');
  });

  it('omits aiAnalysis when not present', () => {
    const article = makeArticle();
    const json = exportMindMapJson(article);
    const parsed = JSON.parse(json);
    expect(parsed.aiAnalysis).toBeUndefined();
  });

  it('falls back to contentText when markdown is empty', () => {
    const article = makeArticle({ markdown: '' });
    const json = exportMindMapJson(article);
    const parsed = JSON.parse(json);
    expect(parsed.content).toBe(article.contentText);
  });
});

// ---- exportMindMapMdx ----

describe('exportMindMapMdx', () => {
  it('generates MDX with frontmatter', () => {
    const article = makeArticle();
    const mdx = exportMindMapMdx(article);

    expect(mdx).toContain('---');
    expect(mdx).toContain('title: "React 18 新特性"');
    expect(mdx).toContain('source: "https://example.com/react-18"');
    expect(mdx).toContain('capturedAt: "2026-06-27T11:00:00Z"');
  });

  it('includes MindMap component import', () => {
    const article = makeArticle();
    const mdx = exportMindMapMdx(article);
    expect(mdx).toContain("import { MindMap } from '@/components/MindMap'");
  });

  it('renders MindMap component with props', () => {
    const article = makeArticle();
    const mdx = exportMindMapMdx(article);
    expect(mdx).toContain('<MindMap');
    expect(mdx).toContain('title="React 18 新特性"');
    expect(mdx).toContain('sourceUrl="https://example.com/react-18"');
  });

  it('includes tags in frontmatter and component props', () => {
    const article = makeArticle();
    (article as any).tags = ['react', 'frontend'];
    const mdx = exportMindMapMdx(article);

    expect(mdx).toContain('tags:');
    expect(mdx).toContain('  - "react"');
    expect(mdx).toContain('  - "frontend"');
    expect(mdx).toContain('tags={["react", "frontend"]}');
  });

  it('includes excerpt as blockquote', () => {
    const article = makeArticle();
    const mdx = exportMindMapMdx(article);
    expect(mdx).toContain('> React 18 带来了并发特性和自动批处理。');
  });

  it('includes AI analysis section when available', () => {
    const article = makeArticle();
    (article as any).aiSummary = 'Concurrent rendering is the key.';
    const mdx = exportMindMapMdx(article);
    expect(mdx).toContain('## AI 分析');
    expect(mdx).toContain('Concurrent rendering is the key.');
  });

  it('does not include AI section when not available', () => {
    const article = makeArticle();
    const mdx = exportMindMapMdx(article);
    expect(mdx).not.toContain('## AI 分析');
  });

  it('uses custom title from options', () => {
    const article = makeArticle();
    const mdx = exportMindMapMdx(article, { format: 'mdx', title: 'Custom Title' });
    expect(mdx).toContain('title: "Custom Title"');
    expect(mdx).toContain('# Custom Title');
  });
});

// ---- exportMindMap (router) ----

describe('exportMindMap', () => {
  it('routes to JSON format', () => {
    const article = makeArticle();
    const result = exportMindMap(article, { format: 'json' });
    const parsed = JSON.parse(result);
    expect(parsed.id).toBe('art-002');
  });

  it('routes to MDX format', () => {
    const article = makeArticle();
    const result = exportMindMap(article, { format: 'mdx' });
    expect(result).toContain('import { MindMap }');
  });
});

// ---- parseHeadings ----

describe('parseHeadings', () => {
  it('extracts headings from markdown', () => {
    const md = '# Title\n\n## Section 1\n\n### Sub 1.1\n\n## Section 2';
    const headings = parseHeadings(md);
    expect(headings).toEqual([
      '# Title',
      '## Section 1',
      '### Sub 1.1',
      '## Section 2',
    ]);
  });

  it('returns empty array for text without headings', () => {
    const md = 'Just some text\nwithout any headings.';
    expect(parseHeadings(md)).toEqual([]);
  });

  it('returns empty array for empty string', () => {
    expect(parseHeadings('')).toEqual([]);
  });
});
