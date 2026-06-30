import { describe, it, expect } from 'vitest'
import { buildPageContext } from './context'
import type { ContextSettings } from '../../types/settings'

describe('buildPageContext', () => {
  it('should format minimal document', () => {
    const result = buildPageContext({
      title: 'Test Page',
      url: 'https://example.com',
      markdown: '# Hello\n\nWorld',
      wordCount: 3,
      tokenCount: 5,
    })

    expect(result).toContain('- Title: Test Page')
    expect(result).toContain('- URL: https://example.com')
    expect(result).toContain('# Hello\n\nWorld')
    // Headings were removed in the settings-driven refactor
    expect(result).not.toContain('## Page Context')
    expect(result).not.toContain('### Content')
  })

  it('should include site name when present', () => {
    const result = buildPageContext({
      title: 'Test Page',
      url: 'https://example.com',
      markdown: 'content',
      wordCount: 1,
      tokenCount: 2,
      siteName: 'Example Site',
    })

    expect(result).toContain('- Site: Example Site')
  })

  it('should not include capturedAt by default even when present', () => {
    const result = buildPageContext({
      title: 'Test Page',
      url: 'https://example.com',
      markdown: 'content',
      wordCount: 1,
      tokenCount: 2,
      capturedAt: '2026-06-28T10:00:00.000Z',
    })

    expect(result).not.toContain('- Captured:')
  })

  it('should include capturedAt when enabled via settings', () => {
    const settings = { includeCapturedAtInPrompt: true } as ContextSettings

    const result = buildPageContext(
      {
        title: 'Test Page',
        url: 'https://example.com',
        markdown: 'content',
        wordCount: 1,
        tokenCount: 2,
        capturedAt: '2026-06-28T10:00:00.000Z',
      },
      settings,
    )

    expect(result).toContain('- Captured: 2026-06-28T10:00:00.000Z')
  })

  it('should not include site name or capturedAt when absent', () => {
    const result = buildPageContext({
      title: 'Test Page',
      url: 'https://example.com',
      markdown: 'content',
      wordCount: 1,
      tokenCount: 2,
    })

    expect(result).not.toContain('- Site:')
    expect(result).not.toContain('- Captured:')
  })

  it('should include all fields when present', () => {
    const settings = { includeCapturedAtInPrompt: true } as ContextSettings

    const result = buildPageContext(
      {
        title: 'Full Page',
        url: 'https://example.com/page',
        markdown: '# Content',
        wordCount: 2,
        tokenCount: 3,
        siteName: 'Example',
        capturedAt: '2026-06-28T12:00:00.000Z',
      },
      settings,
    )

    expect(result).toBe(
      '- Title: Full Page\n- URL: https://example.com/page\n- Site: Example\n- Captured: 2026-06-28T12:00:00.000Z\n# Content',
    )
  })
})
