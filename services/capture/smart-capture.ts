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

export async function captureTab(tab: TabInfo): Promise<ExtractedPage> {
  if (tab.url && isPdfUrl(tab.url)) {
    return extractPdfFromUrl(tab.url)
  }
  if (tab.url && arxivId(tab.url)) {
    return extractArxivFromUrl(tab.url)
  }
  return requestExtract(tab.id)
}
