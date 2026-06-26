// ============================================================
// PageMind — Extract Content Script (On-Demand Injection)
// ============================================================
// Contains the full extraction pipeline (defuddle + shadow-dom + markdown).
// Injected via chrome.scripting.executeScript({files: ['content-scripts/extract.js']})
// only when the user clicks "Extract".
//
// Uses a never-matching matches pattern to prevent automatic injection.

import type { MessageResponse } from '@/messaging/types'
import type { ExtractResponse } from '@/utils/extractor'

export default defineContentScript({
  // Never-match pattern prevents Chrome from auto-injecting this script.
  // It is only injected programmatically via background.ts → executeScript.
  matches: ['*://__pagemind_internal_never_match__/*'],
  main() {
    chrome.runtime.onMessage.addListener(
      (message: { type: string; [k: string]: unknown }, _sender, sendResponse) => {
        if (message.type === 'EXTRACT_PAGE') {
          handleExtract(sendResponse as (r: MessageResponse<ExtractResponse>) => void)
          return true // async response
        }
        return false
      },
    )
  },
})

async function handleExtract(
  sendResponse: (response: MessageResponse<ExtractResponse>) => void,
): Promise<void> {
  try {
    const { extractContent } = await import('@/utils/extractor')
    const result = await extractContent(document, document.URL)

    sendResponse({
      success: true,
      data: result,
    })
  } catch (err) {
    console.error('[PageMind] Extraction failed:', err)
    sendResponse({
      success: false,
      error: `提取失败: ${err instanceof Error ? err.message : String(err)}`,
    })
  }
}
