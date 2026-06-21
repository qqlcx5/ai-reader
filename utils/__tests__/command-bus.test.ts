import { describe, it, expect, beforeEach, vi } from 'vitest';
import { on, emit, send, resetCommandBus } from '../command-bus';

describe('utils/command-bus', () => {
  beforeEach(() => {
    resetCommandBus();
  });

  it('emit triggers a registered handler', () => {
    const handler = vi.fn();
    on('ABORT_ALL_REQUESTS', handler);
    emit('ABORT_ALL_REQUESTS', { reason: 'user' }, 'background');
    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith({
      type: 'ABORT_ALL_REQUESTS',
      payload: { reason: 'user' },
      ts: expect.any(Number),
      source: 'background',
    });
  });

  it('on returns an unsubscribe function', () => {
    const handler = vi.fn();
    const off = on('EXTRACT_PAGE', handler);
    emit('EXTRACT_PAGE');
    expect(handler).toHaveBeenCalledOnce();
    off();
    emit('EXTRACT_PAGE');
    expect(handler).toHaveBeenCalledOnce();
  });

  it('multiple handlers fire in registration order', () => {
    const a = vi.fn();
    const b = vi.fn();
    on('ABORT_ALL_REQUESTS', a);
    on('ABORT_ALL_REQUESTS', b);
    emit('ABORT_ALL_REQUESTS');
    expect(a).toHaveBeenCalledOnce();
    expect(b).toHaveBeenCalledOnce();
  });

  it('handler errors do not break other handlers', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const bad = vi.fn(() => {
      throw new Error('boom');
    });
    const good = vi.fn();
    on('ABORT_ALL_REQUESTS', bad);
    on('ABORT_ALL_REQUESTS', good);
    emit('ABORT_ALL_REQUESTS');
    expect(bad).toHaveBeenCalled();
    expect(good).toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it('send fans out to local listeners when chrome is unavailable', () => {
    // jsdom does not provide chrome.runtime.sendMessage in this setup
    const handler = vi.fn();
    on('ABORT_ALL_REQUESTS', handler);
    send('ABORT_ALL_REQUESTS', undefined, 'background');
    expect(handler).toHaveBeenCalledOnce();
  });

  it('emit on an unregistered type is a no-op', () => {
    const handler = vi.fn();
    on('ABORT_ALL_REQUESTS', handler);
    emit('EXTRACT_PAGE');
    expect(handler).not.toHaveBeenCalled();
  });
});
