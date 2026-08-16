import { describe, it, expect } from 'vitest'
import { handleLocally } from './manager'

const FEED_XML = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <title>Local Parse Feed</title>
    <item><title>A</title><link>https://example.com/a</link><guid>a</guid></item>
  </channel>
</rss>`

describe('handleLocally (Firefox-style in-process path)', () => {
  it('parses feeds without an offscreen document', async () => {
    const res = await handleLocally({ type: 'PARSE_FEED', xml: FEED_XML })
    expect(res.ok).toBe(true)
    expect(res.feed.title).toBe('Local Parse Feed')
    expect(res.feed.items).toHaveLength(1)
  })

  it('extracts HTML bodies', async () => {
    const res = await handleLocally({
      type: 'EXTRACT_HTML',
      html: '<p>一些正文内容，足够长。</p>',
      url: 'https://example.com/x',
      meta: { title: '标题' },
    })
    expect(res.ok).toBe(true)
    expect(res.data.title).toBe('标题')
    expect(res.data.markdown).toContain('正文内容')
  })

  it('returns null for unrelated message types and errors as { ok: false }', async () => {
    expect(await handleLocally({ type: 'SOMETHING_ELSE' })).toBeNull()
    const bad = await handleLocally({ type: 'PARSE_FEED', xml: 'not xml <<' })
    expect(bad.ok).toBe(false)
    expect(typeof bad.error).toBe('string')
  })
})
