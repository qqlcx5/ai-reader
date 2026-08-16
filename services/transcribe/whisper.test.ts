import { describe, it, expect, vi } from 'vitest'
import { transcribeAudio, buildTranscriptDocument, MAX_AUDIO_BYTES } from './whisper'
import type { TranscribeConfig } from '@/types/settings'

const config: TranscribeConfig = {
  baseUrl: 'https://api.example.com/v1/',
  apiKey: 'sk-test',
  model: 'whisper-1',
}

function makeAudio(size: number, name = 'podcast.mp3'): Blob & { name: string } {
  const blob = new Blob([new Uint8Array(size)])
  return Object.assign(blob, { name })
}

describe('transcribeAudio', () => {
  it('posts multipart form with bearer auth and returns the text', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ text: '你好，世界。' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const text = await transcribeAudio(makeAudio(1000), config)

    expect(text).toBe('你好，世界。')
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.example.com/v1/audio/transcriptions')
    expect(init.headers.Authorization).toBe('Bearer sk-test')
    expect(init.body).toBeInstanceOf(FormData)
    expect((init.body as FormData).get('model')).toBe('whisper-1')
    vi.unstubAllGlobals()
  })

  it('rejects files over the 25MB endpoint limit with a hint', async () => {
    await expect(transcribeAudio(makeAudio(MAX_AUDIO_BYTES + 1), config)).rejects.toThrow('25MB')
  })

  it('rejects empty files and missing config', async () => {
    await expect(transcribeAudio(makeAudio(0), config)).rejects.toThrow('为空')
    await expect(transcribeAudio(makeAudio(10), { baseUrl: '', apiKey: '', model: '' })).rejects.toThrow('设置')
  })

  it('surfaces HTTP errors with a truncated detail', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve('Invalid API key supplied'),
    }))
    await expect(transcribeAudio(makeAudio(10), config)).rejects.toThrow('401')
    vi.unstubAllGlobals()
  })
})

describe('buildTranscriptDocument', () => {
  it('builds a transcript document with tag and stable hash id', async () => {
    const doc = await buildTranscriptDocument('小组会议.m4a', '第一段。\n\n第二段。')
    expect(doc.title).toBe('小组会议')
    expect(doc.markdown).toContain('# 小组会议（音频转写）')
    expect(doc.markdown).toContain('第一段。')
    expect(doc.markdown).toContain('第二段。')
    expect(doc.tags).toEqual(['transcript'])
    expect(doc.extractionMethod).toBe('audio')
    expect(doc.url.startsWith('transcript://')).toBe(true)
  })
})
