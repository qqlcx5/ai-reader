/**
 * Smart capture dispatch — routes a tab to the right extraction pipeline:
 *
 *   - .pdf URLs      → fetch + pdf.js text extraction (panel-side, because
 *                      content scripts don't run in Chrome's PDF viewer)
 *   - arXiv URLs     → official HTML version first, PDF fallback
 *   - everything else → content-script defuddle path (requestExtract)
 */
import type { TabInfo } from '@/types/message'
import { requestExtract, type ExtractedPage } from './capture.service'
import { isPdfUrl, arxivId, extractPdfFromUrl, extractArxivFromUrl } from './pdf'
import { isYouTubeWatchUrl, buildYouTubePage, eventsToTranscript } from './youtube'
import { requestYouTubeTranscript } from './capture.service'

export async function captureTab(tab: TabInfo): Promise<ExtractedPage> {
  if (tab.url && isPdfUrl(tab.url)) {
    return extractPdfFromUrl(tab.url)
  }
  if (tab.url && arxivId(tab.url)) {
    return extractArxivFromUrl(tab.url)
  }
  if (tab.url && isYouTubeWatchUrl(tab.url)) {
    try {
      const { details, events } = await requestYouTubeTranscript(tab.id)
      return await buildYouTubePage(details, eventsToTranscript(events))
    } catch {
      // No captions / extraction failed → fall through to the normal page clip.
      return requestExtract(tab.id)
    }
  }
  return requestExtract(tab.id)
}
