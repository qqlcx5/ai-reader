import { describe, it, expect } from 'vitest'
import { youtubeVideoId, isYouTubeWatchUrl, eventsToTranscript, buildYouTubePage } from './youtube'

describe('youtubeVideoId', () => {
  it('extracts ids from all watch url shapes', () => {
    expect(youtubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
    expect(youtubeVideoId('https://youtu.be/dQw4w9WgXcQ?t=30')).toBe('dQw4w9WgXcQ')
    expect(youtubeVideoId('https://www.youtube.com/shorts/abcDEF123-_')).toBe('abcDEF123-_')
    expect(youtubeVideoId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
    expect(isYouTubeWatchUrl('https://m.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(true)
  })

  it('rejects non-video urls and malformed ids', () => {
    expect(youtubeVideoId('https://www.youtube.com/')).toBeNull()
    expect(youtubeVideoId('https://www.youtube.com/feed/subscriptions')).toBeNull()
    expect(youtubeVideoId('https://example.com/watch?v=short')).toBeNull()
    expect(isYouTubeWatchUrl('https://example.com/a')).toBe(false)
  })
})

describe('eventsToTranscript', () => {
  // Expected strings are built dynamically so UnoCSS doesn't scan literal
  // bracket timestamps as CSS class candidates.
  const ts = (m: number, s: number) => `[${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}]`

  it('joins captions within 30s into timestamped paragraphs', () => {
    const transcript = eventsToTranscript([
      { tStartMs: 0, segs: [{ utf8: 'Hello ' }] },
      { tStartMs: 2000, segs: [{ utf8: 'world' }, { utf8: '\n' }] },
      { tStartMs: 35000, segs: [{ utf8: 'New paragraph' }] },
    ])
    expect(transcript).toBe(`${ts(0, 0)} Hello world\n\n${ts(0, 35)} New paragraph`)
  })

  it('drops empty events and newline-only segments', () => {
    const transcript = eventsToTranscript([
      { tStartMs: 1000, segs: [{ utf8: '\n' }] },
      { tStartMs: 2000, segs: [{ utf8: '  ' }] },
      { tStartMs: 3000, segs: [{ utf8: 'real' }] },
    ])
    expect(transcript).toBe(`${ts(0, 3)} real`)
  })

  it('handles missing segs/start gracefully', () => {
    expect(eventsToTranscript([{ tStartMs: 5000 }])).toBe('')
    expect(eventsToTranscript([])).toBe('')
  })
})

describe('buildYouTubePage', () => {
  it('produces a normal ExtractedPageData with header and transcript', async () => {
    const ts0000 = '[' + '00:00' + ']'
    const page = await buildYouTubePage(
      {
        videoId: 'dQw4w9WgXcQ',
        title: '测试视频',
        author: '某频道',
        lengthSeconds: 125,
        description: '视频简介',
      },
      ts0000 + ' 内容',
    )
    expect(page.url).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
    expect(page.title).toBe('测试视频')
    expect(page.siteName).toBe('YouTube')
    expect(page.extractionMethod).toBe('youtube')
    expect(page.markdown).toContain('# 测试视频')
    expect(page.markdown).toContain('> 频道：某频道')
    expect(page.markdown).toContain('> 时长：2:05')
    expect(page.markdown).toContain(ts0000 + ' 内容')
    expect(page.contentHash).toBeTruthy()
    expect(page.wordCount).toBeGreaterThan(0)
  })
})
