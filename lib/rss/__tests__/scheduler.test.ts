import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { initAlarm, RSS_ALARM_NAME } from '@/lib/rss/scheduler';

const alarmsStore = new Map<string, { periodInMinutes: number; delayInMinutes: number }>();

const mockAlarms = {
  create: vi.fn((name: string, opts: { periodInMinutes: number; delayInMinutes: number }) => {
    alarmsStore.set(name, opts);
  }),
  clear: vi.fn((name: string) => { alarmsStore.delete(name); return true; }),
  getAll: vi.fn(() => [...alarmsStore.keys()].map((name) => ({ name }))),
};

beforeEach(() => {
  alarmsStore.clear();
  vi.clearAllMocks();
  (globalThis as unknown as Record<string, unknown>).chrome = { alarms: mockAlarms };
});

afterEach(() => {
  delete (globalThis as unknown as Record<string, unknown>).chrome;
});

describe('scheduler', () => {
  describe('RSS_ALARM_NAME', () => {
    it('is "rss-fetch"', () => {
      expect(RSS_ALARM_NAME).toBe('rss-fetch');
    });
  });

  describe('initAlarm', () => {
    it('creates rss-fetch alarm with default 30-min interval', () => {
      initAlarm();
      expect(mockAlarms.create).toHaveBeenCalledWith(
        'rss-fetch',
        expect.objectContaining({ periodInMinutes: 30 }),
      );
    });

    it('creates alarm with custom interval', () => {
      initAlarm(60);
      expect(mockAlarms.create).toHaveBeenCalledWith(
        'rss-fetch',
        expect.objectContaining({ periodInMinutes: 60 }),
      );
    });
  });
});
