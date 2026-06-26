import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/db/dexie';
import { aggregateTimeline, getStats } from '@/core/timeline/timeline.service';
import type { CapturedDocument } from '@/db/schema';
import dayjs from 'dayjs';

function makeDoc(id: string, createdAt: number): CapturedDocument {
  return {
    id,
    title: `Doc ${id}`,
    url: `https://example.com/${id}`,
    markdownContent: `# ${id}`,
    createdAt,
    updatedAt: createdAt,
  };
}

beforeEach(async () => {
  await db.documents.clear();
});

describe('timeline.service - aggregateTimeline', () => {
  it('should aggregate by day', async () => {
    const today = dayjs().valueOf();
    await db.documents.put(makeDoc('d1', today));
    await db.documents.put(makeDoc('d2', today));
    await db.documents.put(makeDoc('d3', dayjs().subtract(1, 'day').valueOf()));

    const buckets = await aggregateTimeline('day');

    expect(buckets.length).toBeGreaterThanOrEqual(2);
    const todayBucket = buckets.find((b) => b.date === dayjs().format('YYYY-MM-DD'));
    expect(todayBucket?.count).toBe(2);
    expect(todayBucket?.documentIds).toContain('d1');
    expect(todayBucket?.documentIds).toContain('d2');
  });

  it('should aggregate by week', async () => {
    const now = Date.now();
    await db.documents.put(makeDoc('w1', now));
    await db.documents.put(makeDoc('w2', now));

    const buckets = await aggregateTimeline('week');
    expect(buckets.length).toBeGreaterThanOrEqual(1);
  });

  it('should aggregate by month', async () => {
    const now = Date.now();
    await db.documents.put(makeDoc('m1', now));

    const buckets = await aggregateTimeline('month');
    expect(buckets.length).toBeGreaterThanOrEqual(1);
  });
});

describe('timeline.service - getStats', () => {
  it('should return correct stats', async () => {
    const now = Date.now();
    await db.documents.put(makeDoc('s1', now));
    await db.documents.put(makeDoc('s2', now));
    await db.documents.put(makeDoc('s3', dayjs().subtract(30, 'day').valueOf()));

    const stats = await getStats();

    expect(stats.total).toBe(3);
    expect(stats.todayCount).toBe(2);
    expect(stats.streak).toBeGreaterThanOrEqual(1);
    expect(stats.mostActiveDay).not.toBeNull();
  });
});
