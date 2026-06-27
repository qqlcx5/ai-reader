import { useCaptureStore } from '@/stores/capture'
import { useLibraryStore } from '@/stores/library'
import { useSettingsStore } from '@/stores/settings'
import { useToast } from './useToast'
import type { SavedArticle } from '@/shared/domain'

export function useCapture() {
  const capture = useCaptureStore()
  const library = useLibraryStore()
  const settings = useSettingsStore()
  const toast = useToast()

  async function startCapture(url: string) {
    capture.reset()
    capture.setStep('extracting')

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (!tab?.id) {
        capture.setError('PERMISSION_DENIED')
        return
      }

      const response = await chrome.runtime.sendMessage({
        action: 'EXTRACT_PAGE',
        data: { url, tabId: tab.id },
      })

      if (!response || response.error) {
        capture.setError('EXTRACTION_FAILED')
        toast.showError('提取失败', response?.error ?? '未知错误')
        return
      }

      capture.setExtractResult(response)
      capture.setStep('markdown')

      const markdown = response.markdown ?? ''
      capture.setMarkdown(markdown)
      capture.setStep('saving')

      const article: SavedArticle = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        title: response.title ?? 'Untitled',
        url: response.url ?? url,
        siteName: response.siteName ?? '',
        author: response.author ?? '',
        publishedAt: response.publishedAt ?? '',
        excerpt: response.excerpt ?? '',
        markdown,
        contentHtml: response.contentHtml ?? '',
        contentText: response.contentText ?? '',
        faviconUrl: response.faviconUrl ?? '',
        image: response.image ?? '',
        readingTime: response.readingTime ?? 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      if (settings.settings.autoSave) {
        library.addArticle(article)
      }

      capture.setStep('success')
      if (settings.settings.showToast) {
        toast.showSuccess('剪藏成功', article.title)
      }
    } catch (err: any) {
      capture.setError('EXTRACTION_FAILED')
      toast.showError('提取失败', err.message ?? '未知错误')
    }
  }

  return { startCapture }
}
