/**
 * YouTube transcript clipping.
 *
 * Content scripts can't touch page JS variables (isolated world), so the
 * content script mines `ytInitialPlayerResponse` out of the page's <script>
 * tags, fetches the caption track (same-origin), and returns raw events.
 * This module holds the URL helpers + pure conversion logic; the panel-side
 * `buildYouTubePage` turns a transcript into a normal ExtractedPageData.
 */
import { computeHash, countWords, type ExtractedPageData } from '@/utils/content/extract'
import { estimateTokens } from '@/utils/token'

export function youtubeVideoId(url: string): string | null {
  try {
    const u = new URL(url)
    const host = u.hostname.replace(/^(www\.|m\.|music\.)/, '')
    if (host === 'youtu.be') {
      const id = u.pathname.slice(1).split('/')[0]
      return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null
    }
    if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
      const v = u.searchParams.get('v')
      if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v
      const m = /^\/(shorts|embed|live)\/([a-zA-Z0-9_-]{11})/.exec(u.pathname)
      if (m) return m[2]
    }
    return null
  } catch {
    return null
  }
}

export function isYouTubeWatchUrl(url: string): boolean {
  return youtubeVideoId(url) != null
}

// ---------------------------------------------------------------------------
// Transcript conversion — pure
// ---------------------------------------------------------------------------

export interface TranscriptEvent {
  tStartMs?: number
  dDurationMs?: number
  segs?: { utf8: string }[]
}

function formatTimestamp(ms: number): string {
  const total = Math.floor(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/**
 * Convert json3 caption events into a readable, timestamped transcript:
 * consecutive captions are grouped into paragraphs of ~30s, each prefixed
 * with a mm:ss timestamp in square brackets.
 */
export function eventsToTranscript(events: TranscriptEvent[]): string {
  const lines = events
    .map((e) => ({
      start: e.tStartMs ?? 0,
      // Strip the '\n' segments YouTube uses to mark line breaks.
      text: (e.segs ?? []).map((s) => s.utf8).join('').replace(/\n/g, ' ').trim(),
    }))
    .filter((l) => l.text.length > 0)

  const paragraphs: string[] = []
  let current: { start: number; parts: string[] } | null = null
  for (const line of lines) {
    if (!current || line.start - current.start > 30_000) {
      if (current) paragraphs.push(`[${formatTimestamp(current.start)}] ${current.parts.join(' ')}`)
      current = { start: line.start, parts: [line.text] }
    } else {
      current.parts.push(line.text)
    }
  }
  if (current) paragraphs.push(`[${formatTimestamp(current.start)}] ${current.parts.join(' ')}`)

  return paragraphs.join('\n\n')
}

// ---------------------------------------------------------------------------
// Panel-side payload assembly
// ---------------------------------------------------------------------------

export interface YouTubeVideoDetails {
  videoId: string
  title: string
  author?: string
  lengthSeconds?: number
  description?: string
}

/** Build the final ExtractedPageData for a clipped video. */
export async function buildYouTubePage(
  details: YouTubeVideoDetails,
  transcript: string,
): Promise<ExtractedPageData> {
  const url = `https://www.youtube.com/watch?v=${details.videoId}`
  const header: string[] = []
  if (details.author) header.push(`> 频道：${details.author}`)
  if (details.lengthSeconds) {
    const m = Math.floor(details.lengthSeconds / 60)
    const s = details.lengthSeconds % 60
    header.push(`> 时长：${m}:${String(s).padStart(2, '0')}`)
  }
  const markdown = [
    `# ${details.title || 'YouTube 视频'}`,
    '',
    ...header,
    '',
    '## 字幕',
    '',
    transcript.trim() || '（无字幕内容）',
  ].join('\n')

  return {
    url,
    title: details.title || 'YouTube 视频',
    markdown,
    siteName: 'YouTube',
    author: details.author,
    description: details.description?.slice(0, 300) || undefined,
    contentHash: await computeHash(markdown),
    wordCount: countWords(markdown),
    tokenCount: estimateTokens(markdown),
    extractionMethod: 'youtube',
  }
}
