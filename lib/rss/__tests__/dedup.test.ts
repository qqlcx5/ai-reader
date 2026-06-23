import { describe, expect, it } from 'vitest';
import { computeArticleId, filterNewArticles } from '@/lib/rss/dedup';
import type { RawArticle } from '@/lib/rss/types';

function makeArticle(link: string): RawArticle {
  return { title: 'Title', link, description: 'desc', pubDate: Date.now() };
}

describe('dedup', () => {
  describe('computeArticleId', () => {
    it('returns a consistent 64-char hex hash for the same link', async () => {
      const a = await computeArticleId({ link: 'https://example.com/1' });
      const b = await computeArticleId({ link: 'https://example.com/1' });
      expect(a).toBe(b);
      expect(a).toMatch(/^[0-9a-f]{64}$/);
    });

    it('produces different hashes for different links', async () => {
      const a = await computeArticleId({ link: 'https://a.com' });
      const b = await computeArticleId({ link: 'https://b.com' });
      expect(a).not.toBe(b);
    });

    it('handles empty string link', async () => {
      const hash = await computeArticleId({ link: '' });
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  describe('filterNewArticles', () => {
    it('returns all articles when no existing IDs', async () => {
      const articles = [makeArticle('https://a.com'), makeArticle('https://b.com')];
      const result = await filterNewArticles(articles, new Set());
      expect(result).toHaveLength(2);
    });

    it('filters out articles whose ID already exists', async () => {
      const articles = [makeArticle('https://a.com'), makeArticle('https://b.com')];
      const existingId = await computeArticleId(articles[0]);
      const result = await filterNewArticles(articles, new Set([existingId]));
      expect(result).toHaveLength(1);
      expect(result[0].link).toBe('https://b.com');
    });

    it('returns empty array when all articles exist', async () => {
      const articles = [makeArticle('https://a.com')];
      const id = await computeArticleId(articles[0]);
      const result = await filterNewArticles(articles, new Set([id]));
      expect(result).toHaveLength(0);
    });
  });
});
