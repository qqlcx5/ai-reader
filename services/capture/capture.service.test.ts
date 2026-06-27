import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { requestExtract, CaptureError } from './capture.service'

// Mock browser.runtime.sendMessage
const mockSendMessage = vi.fn()
const mockBrowser = {
  runtime: {
    sendMessage: mockSendMessage,
  },
}

beforeEach(() => {
  vi.stubGlobal('browser', mockBrowser)
  mockSendMessage.mockReset()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('services/capture/capture.service', () => {
  describe('requestExtract', () => {
    it('should resolve with PAGE_EXTRACTED response', async () => {
      mockSendMessage.mockResolvedValueOnce({
        type: 'PAGE_EXTRACTED',
        payload: {
          url: 'https://example.com',
          title: 'Test Page',
          markdown: '# Hello',
          contentHash: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
          wordCount: 42,
          tokenCount: 10,
          extractionMethod: 'defuddle',
          siteName: 'example.com',
          author: 'Tester',
          description: 'A test',
          publishedAt: '2026-01-15',
        },
      })

      const result = await requestExtract(1)

      expect(result.url).toBe('https://example.com')
      expect(result.title).toBe('Test Page')
      expect(result.markdown).toBe('# Hello')
      expect(result.wordCount).toBe(42)
      expect(result.tokenCount).toBe(10)
      expect(result.extractionMethod).toBe('defuddle')
    })

    it('should reject on EXTRACT_ERROR', async () => {
      mockSendMessage.mockResolvedValueOnce({
        type: 'EXTRACT_ERROR',
        payload: {
          error: 'Something went wrong',
        },
      })

      await expect(requestExtract(1)).rejects.toThrow(CaptureError)
    })

    it('should reject on sendMessage failure', async () => {
      mockSendMessage.mockRejectedValueOnce(new Error('Network failure'))

      await expect(requestExtract(1)).rejects.toThrow(CaptureError)
    })

    it('should reject on unexpected response type', async () => {
      mockSendMessage.mockResolvedValueOnce({
        type: 'UNKNOWN_TYPE',
        payload: {},
      })

      await expect(requestExtract(1)).rejects.toThrow(CaptureError)
    })
  })
})
