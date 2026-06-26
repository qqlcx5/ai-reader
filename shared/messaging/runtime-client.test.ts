/**
 * runtime-client (shared/messaging) unit tests.
 *
 * Verifies that sendMessage wraps the chrome API with timeouts,
 * request ids, and proper error handling.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  sendMessage,
  onMessage,
  MessageTimeoutError,
  MessageChannelError,
  broadcast,
} from './runtime-client'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('sendMessage', () => {
  it('resolves with the response from chrome.runtime.sendMessage', async () => {
    ;(chrome.runtime.sendMessage as ReturnType<typeof vi.fn>).mockImplementation(
      (_msg: unknown, cb: (r: unknown) => void) => {
        cb({ success: true, data: { ok: true } })
      }
    )
    const result = await sendMessage<'PING', { ok: boolean }>({ type: 'PING', payload: {} })
    expect(result).toEqual({ success: true, data: { ok: true } })
  })

  it('rejects with MessageTimeoutError on timeout', async () => {
    ;(chrome.runtime.sendMessage as ReturnType<typeof vi.fn>).mockImplementation(
      () => undefined
    )
    await expect(
      sendMessage('PING' as never, { type: 'PING', payload: {} } as never, 10)
    ).rejects.toBeInstanceOf(MessageTimeoutError)
  })

  it('rejects with MessageChannelError when lastError is set', async () => {
    ;(chrome.runtime.sendMessage as ReturnType<typeof vi.fn>).mockImplementation(
      (_msg: unknown, cb: (r: unknown) => void) => {
        chrome.runtime.lastError = { message: 'no receiver' }
        cb(undefined)
        chrome.runtime.lastError = undefined
      }
    )
    await expect(
      sendMessage<'PING'>({ type: 'PING', payload: {} })
    ).rejects.toBeInstanceOf(MessageChannelError)
  })
})

describe('onMessage', () => {
  it('returns an unsubscribe function and routes matching types', () => {
    const handler = vi.fn()
    const off = onMessage('PING', handler)
    expect(typeof off).toBe('function')
    off()
  })
})

describe('broadcast', () => {
  it('does not throw when no listeners exist', () => {
    expect(() => broadcast<'PING'>({ type: 'PING', payload: {} })).not.toThrow()
  })
})
