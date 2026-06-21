import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { updateBadge } from '@/lib/rss/badge';

// Mock chrome.action / browser.action
const action = {
  setBadgeText: vi.fn(async () => {}),
  setBadgeBackgroundColor: vi.fn(async () => {}),
};

beforeEach(() => {
  vi.clearAllMocks();
  (globalThis as unknown as Record<string, unknown>).chrome = { action };
});

afterEach(() => {
  delete (globalThis as unknown as Record<string, unknown>).chrome;
});

// Mock dexie db
vi.mock('@/modules/storage/db', () => {
  let unreadCount = 0;
  return {
    getDb: () => ({
      rssItems: {
        where: () => ({
          equals: () => ({
            count: async () => unreadCount,
          }),
        }),
      },
    }),
    _setUnreadCount: (n: number) => { unreadCount = n; },
  };
});

describe('badge', () => {
  it('sets badge with count when unread items exist', async () => {
    const { _setUnreadCount } = await import('@/modules/storage/db') as any;
    _setUnreadCount(5);
    const count = await updateBadge();
    expect(count).toBe(5);
    expect(action.setBadgeText).toHaveBeenCalledWith({ text: '5' });
    expect(action.setBadgeBackgroundColor).toHaveBeenCalledWith({ color: '#EF4444' });
  });

  it('clears badge when no unread items', async () => {
    const { _setUnreadCount } = await import('@/modules/storage/db') as any;
    _setUnreadCount(0);
    const count = await updateBadge();
    expect(count).toBe(0);
    expect(action.setBadgeText).toHaveBeenCalledWith({ text: '' });
  });

  it('caps badge at 99+', async () => {
    const { _setUnreadCount } = await import('@/modules/storage/db') as any;
    _setUnreadCount(150);
    const count = await updateBadge();
    expect(count).toBe(150);
    expect(action.setBadgeText).toHaveBeenCalledWith({ text: '99+' });
  });
});
