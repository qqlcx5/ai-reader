import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { scheduleAllFeeds, parseRssAlarmName, RSS_ALARM_PREFIX } from '@/lib/rss/scheduler';
import type { RssFeedRecord } from '@/lib/rss/types';

function makeFeed(id: string, enabled = true, interval?: number): RssFeedRecord {
  return { id, url: `https://feed-${id}.xml`, enabled, lastFetchedAt: 0, refreshIntervalMinutes: interval };
}

const alarmsStore = new Map<string, { periodInMinutes: number }>();

const mockAlarmsApi = {
  create: vi.fn(async (name: string, opts: { periodInMinutes: number }) => { alarmsStore.set(name, opts); }),
  clear: vi.fn(async (name: string) => { alarmsStore.delete(name); return true; }),
  getAll: vi.fn(async () => [...alarmsStore.keys()].map((name) => ({ name }))),
  clearAll: vi.fn(async () => { alarmsStore.clear(); }),
};

beforeEach(() => {
  alarmsStore.clear();
  vi.clearAllMocks();
  (globalThis as unknown as Record<string, unknown>).chrome = { alarms: mockAlarmsApi };
});

afterEach(() => {
  delete (globalThis as unknown as Record<string, unknown>).chrome;
});

describe('scheduler', () => {
  describe('parseRssAlarmName', () => {
    it('extracts feedId from rss: prefix', () => {
      expect(parseRssAlarmName('rss:feed-1')).toBe('feed-1');
    });
    it('returns null for non-rss alarms', () => {
      expect(parseRssAlarmName('auto-backup')).toBeNull();
      expect(parseRssAlarmName('rss:')).toBeNull();
    });
  });

  describe('scheduleAllFeeds', () => {
    it('creates alarms for enabled feeds with default 360min interval', async () => {
      await scheduleAllFeeds([makeFeed('a'), makeFeed('b')]);
      expect(mockAlarmsApi.create).toHaveBeenCalledTimes(2);
      expect(alarmsStore.get('rss:a')).toEqual({ periodInMinutes: 360 });
      expect(alarmsStore.get('rss:b')).toEqual({ periodInMinutes: 360 });
    });

    it('uses custom interval when specified', async () => {
      await scheduleAllFeeds([makeFeed('a', true, 60)]);
      expect(alarmsStore.get('rss:a')).toEqual({ periodInMinutes: 60 });
    });

    it('skips disabled feeds', async () => {
      await scheduleAllFeeds([makeFeed('a', true), makeFeed('b', false)]);
      expect(mockAlarmsApi.create).toHaveBeenCalledTimes(1);
      expect(alarmsStore.has('rss:b')).toBe(false);
    });

    it('enforces minimum 1-minute interval', async () => {
      await scheduleAllFeeds([makeFeed('a', true, 0)]);
      expect(alarmsStore.get('rss:a')).toEqual({ periodInMinutes: 1 });
    });
  });
});
