import { describe, expect, it } from 'vitest';
import { computeItemHash, filterNewItems } from '@/lib/rss/dedup';

describe('dedup', () => {
  describe('computeItemHash', () => {
    it('returns a consistent hex hash for the same input', () => {
      const a = computeItemHash({ feedId: 'f1', title: 'Hello', link: 'https://example.com' });
      const b = computeItemHash({ feedId: 'f1', title: 'Hello', link: 'https://example.com' });
      expect(a).toBe(b);
      expect(a).toMatch(/^[0-9a-f]{8}$/);
    });

    it('produces different hashes for different titles', () => {
      const a = computeItemHash({ feedId: 'f1', title: 'Hello', link: 'https://a.com' });
      const b = computeItemHash({ feedId: 'f1', title: 'World', link: 'https://a.com' });
      expect(a).not.toBe(b);
    });

    it('produces different hashes for different feedIds', () => {
      const a = computeItemHash({ feedId: 'f1', title: 'Hello', link: 'https://x.com' });
      const b = computeItemHash({ feedId: 'f2', title: 'Hello', link: 'https://x.com' });
      expect(a).not.toBe(b);
    });

    it('handles empty strings', () => {
      const hash = computeItemHash({ feedId: '', title: '', link: '' });
      expect(hash).toMatch(/^[0-9a-f]{8}$/);
    });
  });

  describe('filterNewItems', () => {
    it('returns all items when no existing hashes', () => {
      const items = [
        { feedId: 'f1', title: 'A', link: 'http://a.com' },
        { feedId: 'f1', title: 'B', link: 'http://b.com' },
      ];
      const result = filterNewItems(items, new Set());
      expect(result).toHaveLength(2);
    });

    it('filters out items whose hash already exists', () => {
      const items = [
        { feedId: 'f1', title: 'A', link: 'http://a.com' },
        { feedId: 'f1', title: 'B', link: 'http://b.com' },
      ];
      const existingHash = computeItemHash(items[0]);
      const result = filterNewItems(items, new Set([existingHash]));
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('B');
    });

    it('returns empty array when all items exist', () => {
      const items = [
        { feedId: 'f1', title: 'A', link: 'http://a.com' },
      ];
      const hash = computeItemHash(items[0]);
      const result = filterNewItems(items, new Set([hash]));
      expect(result).toHaveLength(0);
    });
  });
});
