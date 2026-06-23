import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { updateBadge } from '@/lib/rss/badge';

// Mock chrome.action
const action = {
  setBadgeText: vi.fn(async () => {}),
  setBadgeBackgroundColor: vi.fn(async () => {}),
};

// Mock rssRepo
let mockUnreadCount = 0;
vi.mock('@/lib/db/repositories/rss.repo', () => ({
  rssRepo: {
    getUnreadCount: vi.fn(async () => mockUnreadCount),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockUnreadCount = 0;
  (globalThis as unknown as Record<string, unknown>).chrome = { action };
});

afterEach(() => {
  delete (globalThis as unknown as Record<string, unknown>).chrome;
});

describe('badge', () => {
  it('sets badge with count when unread items exist', async () => {
    mockUnreadCount = 5;
    await updateBadge();
    expect(action.setBadgeText).toHaveBeenCalledWith({ text: '5' });
    expect(action.setBadgeBackgroundColor).toHaveBeenCalledWith({ color: '#5b60e5' });
  });

  it('clears badge when no unread items', async () => {
    mockUnreadCount = 0;
    await updateBadge();
    expect(action.setBadgeText).toHaveBeenCalledWith({ text: '' });
  });

  it('shows "99" for exactly 99 items', async () => {
    mockUnreadCount = 99;
    await updateBadge();
    expect(action.setBadgeText).toHaveBeenCalledWith({ text: '99' });
  });
});
