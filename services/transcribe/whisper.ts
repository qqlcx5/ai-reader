/**
 * Local audio transcription via a Whisper-compatible endpoint
 * (OpenAI / Groq / SiliconFlow all expose POST /audio/transcriptions).
 *
 * The user picks an audio file (podcast, meeting, voice memo) in the library
 * view; the file is sent once, and the transcript becomes a normal document.
 */
import dayjs from 'dayjs'
import { computeHash, countWords } from '@/utils/content/extract'
import { estimateTokens } from '@/utils/token'
import type { DocumentEntity } from '@/types/document'
import type { TranscribeConfig } from '@/types/settings'

/** Whisper endpoints cap uploads at 25 MB. */
export const MAX_AUDIO_BYTES = 25 * 1024 * 1024

export interface TranscribeResult {
  text: string
}

/** Send an audio blob to the transcription endpoint. */
export async function transcribeAudio(
  file: Blob & { name?: string },
  config: TranscribeConfig,
  signal?: AbortSignal,
): Promise<string> {
  if (file.size === 0) throw new Error('音频文件为空')
  if (file.size > MAX_AUDIO_BYTES) {
    throw new Error('音频超过 25MB 上限，请先剪辑或压缩（可拆分为多段）')
  }
  if (!config.baseUrl || !config.apiKey) throw new Error('请先在设置中配置音频转写服务')

  const form = new FormData()
  form.append('file', file, file.name || 'audio.webm')
  form.append('model', config.model || 'whisper-1')
  form.append('response_format', 'json')

  const base = config.baseUrl.replace(/\/+$/, '')
  const res = await fetch(`${base}/audio/transcriptions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.apiKey}` },
    body: form,
    signal,
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`转写失败：HTTP ${res.status} ${detail.slice(0, 200)}`)
  }
  const data = (await res.json()) as TranscribeResult
  if (!data.text || !data.text.trim()) throw new Error('转写结果为空')
  return data.text.trim()
}

/** Turn a raw transcript into a library document (pure — for tests). */
export async function buildTranscriptDocument(filename: string, text: string): Promise<DocumentEntity> {
  const title = (filename.replace(/\.[a-z0-9]+$/i, '') || '音频转写').slice(0, 120)
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
  const markdown = `# ${title}（音频转写）\n\n${paragraphs.join('\n\n')}`

  const contentHash = await computeHash(markdown)
  const now = dayjs().toISOString()
  return {
    id: contentHash,
    url: `transcript://${contentHash.slice(0, 12)}`,
    title,
    markdown,
    wordCount: countWords(markdown),
    tokenCount: estimateTokens(markdown),
    contentHash,
    extractionMethod: 'audio',
    source: 'library',
    tags: ['transcript'],
    capturedAt: now,
    updatedAt: now,
  }
}
