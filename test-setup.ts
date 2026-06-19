import { vi } from 'vitest';

vi.mock('wxt/browser', () => ({
  browser: {
    storage: {
      local: {
        get: vi.fn().mockResolvedValue({}),
        set: vi.fn().mockResolvedValue(undefined),
        remove: vi.fn().mockResolvedValue(undefined),
      },
      session: {
        get: vi.fn().mockResolvedValue({}),
        set: vi.fn().mockResolvedValue(undefined),
        remove: vi.fn().mockResolvedValue(undefined),
      },
    },
    runtime: {
      connect: vi.fn(),
      sendMessage: vi.fn().mockResolvedValue(undefined),
      onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
      onConnect: { addListener: vi.fn() },
    },
    tabs: {
      sendMessage: vi.fn().mockResolvedValue(undefined),
      query: vi.fn().mockResolvedValue([]),
    },
    action: { onClicked: { addListener: vi.fn() } },
    sidePanel: { open: vi.fn() },
    commands: { onCommand: { addListener: vi.fn() } },
  },
}));
