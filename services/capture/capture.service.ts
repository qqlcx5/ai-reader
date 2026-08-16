import type { PageExtractedPayload, ExtractErrorPayload } from '@/types/message'
import type { YouTubeVideoDetails, TranscriptEvent } from './youtube'

const EXTRACT_TIMEOUT_MS = 15_000

export interface ExtractedPage extends PageExtractedPayload {}

export interface YouTubeTranscriptPayload {
  details: YouTubeVideoDetails
  events: TranscriptEvent[]
}

export class CaptureError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CaptureError'
  }
}

export function requestExtract(tabId: number): Promise<ExtractedPage> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new CaptureError('Extraction timed out after 15 seconds'))
    }, EXTRACT_TIMEOUT_MS)

    browser.runtime
      .sendMessage({
        type: 'EXTRACT_PAGE',
        payload: { tabId },
      })
      .then((response: any) => {
        clearTimeout(timeoutId)

        if (response.type === 'EXTRACT_ERROR') {
          const errPayload = response.payload as ExtractErrorPayload
          reject(new CaptureError(errPayload.error || 'Unknown extraction error'))
          return
        }

        if (response.type === 'PAGE_EXTRACTED') {
          resolve(response.payload as ExtractedPage)
          return
        }

        reject(new CaptureError(`Unexpected response type: ${response.type}`))
      })
      .catch((err: Error) => {
        clearTimeout(timeoutId)
        reject(new CaptureError(err.message || 'Failed to send extract request'))
      })
  })
}

/** Ask the content script of `tabId` to fetch the video's caption track. */
export function requestYouTubeTranscript(tabId: number): Promise<YouTubeTranscriptPayload> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new CaptureError('字幕提取超时（15 秒）'))
    }, EXTRACT_TIMEOUT_MS)

    browser.runtime
      .sendMessage({
        type: 'EXTRACT_YOUTUBE',
        payload: { tabId },
      })
      .then((response: any) => {
        clearTimeout(timeoutId)

        if (response.type === 'EXTRACT_ERROR') {
          reject(new CaptureError(response.payload?.error || 'Unknown extraction error'))
          return
        }
        if (response.type === 'YOUTUBE_TRANSCRIPT') {
          resolve(response.payload as YouTubeTranscriptPayload)
          return
        }
        reject(new CaptureError(`Unexpected response type: ${response.type}`))
      })
      .catch((err: Error) => {
        clearTimeout(timeoutId)
        reject(new CaptureError(err.message || 'Failed to send extract request'))
      })
  })
}
