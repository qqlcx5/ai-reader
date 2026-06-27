import type { PageExtractedPayload, ExtractErrorPayload } from '@/types/message'

const EXTRACT_TIMEOUT_MS = 15_000

export interface ExtractedPage extends PageExtractedPayload {}

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
