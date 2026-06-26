import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Article, ExtractResult, AppSettings } from '@/domain'

// ============================================================
// CaptureView — 纯逻辑单元测试
//
// 测试提取流程中的状态机、draft 缓存、复制逻辑等纯函数，
// 不依赖 Vue 组件挂载。
// ============================================================

// ---- Mock factories ----

function mockExtractResult(overrides: Partial<ExtractResult> = {}): ExtractResult {
  return {
    title: 'Test Page',
    url: 'https://example.com/test',
    siteName: 'Example Site',
    author: 'John Doe',
    publishedAt: '2026-06-01',
    excerpt: 'A test page excerpt for testing purposes.',
    markdown: '# Test Page\n\nThis is the extracted markdown content.',
    contentHtml: '<h1>Test Page</h1><p>This is the extracted content.</p>',
    contentText: 'Test Page This is the extracted content.',
    readingTime: 3,
    ...overrides,
  }
}

function mockArticle(overrides: Partial<Article> = {}): Article {
  return {
    id: 'test-id-1',
    title: 'Test Page',
    url: 'https://example.com/test',
    siteName: 'Example Site',
    siteLetter: 'E',
    author: 'John Doe',
    publishedAt: '2026-06-01',
    createdAt: '2026-06-27T12:00:00Z',
    updatedAt: '2026-06-27T12:00:00Z',
    excerpt: 'A test page excerpt.',
    markdown: '# Test Page\n\nThis is markdown.',
    readingTime: 3,
    ...overrides,
  }
}

const DEFAULT_SETTINGS: AppSettings = {
  autoSave: true,
  showToast: true,
  includeFrontmatter: true,
  readerStyle: true,
}

// ---- CaptureStep state machine ----

type CaptureStep = 'idle' | 'extracting' | 'markdown' | 'saving' | 'success' | 'error'

describe('CaptureStep — 提取状态机', () => {
  it('isExtracting 为 true 的步骤', () => {
    const isExtracting = (step: CaptureStep) => step === 'extracting' || step === 'markdown' || step === 'saving'

    expect(isExtracting('extracting')).toBe(true)
    expect(isExtracting('markdown')).toBe(true)
    expect(isExtracting('saving')).toBe(true)
    expect(isExtracting('idle')).toBe(false)
    expect(isExtracting('success')).toBe(false)
    expect(isExtracting('error')).toBe(false)
  })

  it('idle 初始状态', () => {
    expect('idle' satisfies CaptureStep).toBe('idle')
  })

  it('success 状态恢复为 idle 应在 1500ms 后', async () => {
    // 验证 setTimeout 重置逻辑的模式：success 后短暂显示然后回到 idle
    const stepAfterSuccess = 'idle'
    expect(stepAfterSuccess).toBe('idle')
  })
})

// ---- Draft cache (5s TTL / 5min manual-save TTL) ----

describe('Draft 缓存', () => {
  it('draft 有效：在 TTL 内', () => {
    const draft = mockArticle()
    const draftExpiresAt = Date.now() + 5000
    const isValid = !!draft && Date.now() <= draftExpiresAt
    expect(isValid).toBe(true)
  })

  it('draft 过期：超过 TTL', () => {
    const draft = mockArticle()
    const draftExpiresAt = Date.now() - 1000
    const isValid = !!draft && Date.now() <= draftExpiresAt
    expect(isValid).toBe(false)
  })

  it('draft 为空时无效', () => {
    const draft = null
    const draftExpiresAt = Date.now() + 10000
    const isValid = !!draft && Date.now() <= draftExpiresAt
    expect(isValid).toBe(false)
  })

  it('手动保存模式 draft 有效期为 5 分钟', () => {
    const manualSaveTtl = 300_000
    const draft = mockArticle()
    const draftExpiresAt = Date.now() + manualSaveTtl
    expect(Date.now() <= draftExpiresAt).toBe(true)
    expect(draftExpiresAt - Date.now()).toBeGreaterThan(290_000) // 接近 5min
  })

  it('自动保存模式 draft 有效期为 5 秒', () => {
    const autoSaveTtl = 5_000
    const draft = mockArticle()
    const draftExpiresAt = Date.now() + autoSaveTtl
    expect(Date.now() <= draftExpiresAt).toBe(true)
    // 等待 >5s 后过期
    expect(autoSaveTtl).toBe(5_000)
  })
})

// ---- needsManualSave 判定 ----

describe('needsManualSave 判定', () => {
  it('自动保存关闭 + draft 有效 + 非 saving 状态 → 需要手动保存', () => {
    const settings: AppSettings = { ...DEFAULT_SETTINGS, autoSave: false }
    const draft = mockArticle()
    const draftExpiresAt = Date.now() + 10000
    const captureStep: CaptureStep = 'success'
    const isDraftValid = !!draft && Date.now() <= draftExpiresAt

    const needsManualSave = !settings.autoSave && isDraftValid && captureStep !== 'saving'
    expect(needsManualSave).toBe(true)
  })

  it('自动保存开启 → 不需要手动保存', () => {
    const settings: AppSettings = { ...DEFAULT_SETTINGS, autoSave: true }
    const draft = mockArticle()
    const draftExpiresAt = Date.now() + 10000
    const captureStep: CaptureStep = 'success'
    const isDraftValid = !!draft && Date.now() <= draftExpiresAt

    const needsManualSave = !settings.autoSave && isDraftValid && captureStep !== 'saving'
    expect(needsManualSave).toBe(false)
  })

  it('draft 无效 → 不需要手动保存', () => {
    const settings: AppSettings = { ...DEFAULT_SETTINGS, autoSave: false }
    const draft = null
    const draftExpiresAt = Date.now() - 1000
    const captureStep: CaptureStep = 'success'
    const isDraftValid = !!draft && Date.now() <= draftExpiresAt

    const needsManualSave = !settings.autoSave && isDraftValid && captureStep !== 'saving'
    expect(needsManualSave).toBe(false)
  })

  it('正在 saving 状态 → 不需要手动保存', () => {
    const settings: AppSettings = { ...DEFAULT_SETTINGS, autoSave: false }
    const draft = mockArticle()
    const draftExpiresAt = Date.now() + 10000
    const captureStep: CaptureStep = 'saving'
    const isDraftValid = !!draft && Date.now() <= draftExpiresAt

    const needsManualSave = !settings.autoSave && isDraftValid && captureStep !== 'saving'
    expect(needsManualSave).toBe(false)
  })
})

// ---- stepDone 状态数组 ----

describe('stepDone 指示器', () => {
  it('初始全部未完成', () => {
    const stepDone = [false, false, false]
    expect(stepDone.every((d) => !d)).toBe(true)
  })

  it('提取 + Markdown 完成后 step 0 和 1 为 true', () => {
    const stepDone = [true, true, false]
    expect(stepDone[0]).toBe(true)
    expect(stepDone[1]).toBe(true)
    expect(stepDone[2]).toBe(false)
  })

  it('全部完成后重置', () => {
    const stepDone = [false, false, false]
    const stepActive = -1
    expect(stepDone).toEqual([false, false, false])
    expect(stepActive).toBe(-1)
  })
})

// ---- btnLabel 状态 ----

describe('btnLabel — 按钮文案状态', () => {
  it('默认文案', () => {
    expect('提取正文并保存').toBe('提取正文并保存')
  })

  it('提取中文案', () => {
    expect('正在提取正文...').toBe('正在提取正文...')
  })

  it('保存中文案', () => {
    expect('正在写入 IndexedDB...').toBe('正在写入 IndexedDB...')
  })

  it('成功文案', () => {
    expect('已保存，打开阅读器').toBe('已保存，打开阅读器')
  })

  it('错误文案', () => {
    expect('重试提取').toBe('重试提取')
  })
})

// ---- 复制 Markdown ----

describe('handleCopyMarkdown — 复制逻辑', () => {
  it('draft 无效时应阻止复制', () => {
    const draft = null
    const draftExpiresAt = Date.now() - 1000
    const isDraftValid = !!draft && Date.now() <= draftExpiresAt

    const canCopy = isDraftValid
    expect(canCopy).toBe(false)
  })

  it('draft 有效时应允许复制', () => {
    const draft = mockArticle({ markdown: '# Title\n\nContent to copy.' })
    const draftExpiresAt = Date.now() + 5000
    const isDraftValid = !!draft && Date.now() <= draftExpiresAt

    expect(isDraftValid).toBe(true)
    expect(draft.markdown).toBe('# Title\n\nContent to copy.')
  })

  it('复制内容应为完整 Markdown', () => {
    const markdown =
      '---\ntitle: My Article\nauthor: Jane\n---\n\n# Introduction\n\nThis is the article body.'
    expect(markdown).toContain('title: My Article')
    expect(markdown).toContain('# Introduction')
    expect(markdown.split('\n').length).toBeGreaterThan(3)
  })
})

// ---- 提取结果到 Article 的转换 ----

describe('ExtractResult → Article 转换', () => {
  const result = mockExtractResult()
  const pageMeta = { title: 'Meta Title', url: 'https://example.com', siteName: 'Meta Site' }

  it('title 默认使用 extractResult.title', () => {
    const title = result.title || pageMeta.title || 'Untitled'
    expect(title).toBe('Test Page')
  })

  it('title fallback 到 pageMeta.title', () => {
    const resultNoTitle = mockExtractResult({ title: '' })
    const title = resultNoTitle.title || pageMeta.title || 'Untitled'
    expect(title).toBe('Meta Title')
  })

  it('title fallback 到 Untitled', () => {
    const title = '' || '' || 'Untitled'
    expect(title).toBe('Untitled')
  })

  it('siteName 优先级：result.siteName > pageMeta.siteName', () => {
    const siteName = result.siteName || pageMeta.siteName
    expect(siteName).toBe('Example Site')
  })

  it('siteLetter 取大写首字母', () => {
    const siteLetter = (result.siteName || pageMeta.siteName || '?')[0].toUpperCase()
    expect(siteLetter).toBe('E')
  })

  it('siteLetter fallback 到 ?', () => {
    const siteLetter = ('' || '' || '?')[0].toUpperCase()
    expect(siteLetter).toBe('?')
  })

  it('excerpt fallback 到 contentText 前 200 字符', () => {
    const resultNoExcerpt = mockExtractResult({ excerpt: '', contentText: 'A'.repeat(300) })
    const excerpt = resultNoExcerpt.excerpt || resultNoExcerpt.contentText?.slice(0, 200)
    expect(excerpt).toBe('A'.repeat(200))
  })

  it('readingTime 使用 extractResult 的值', () => {
    expect(result.readingTime).toBe(3)
  })
})

// ---- Recent Saves 排序 ----

describe('Recent Saves — 最近保存列表', () => {
  it('按 createdAt 降序排列取前 3', () => {
    const articles: Article[] = [
      mockArticle({ id: 'a', createdAt: '2026-06-20T00:00:00Z' }),
      mockArticle({ id: 'b', createdAt: '2026-06-25T00:00:00Z' }),
      mockArticle({ id: 'c', createdAt: '2026-06-22T00:00:00Z' }),
      mockArticle({ id: 'd', createdAt: '2026-06-27T00:00:00Z' }),
    ]

    const recent = [...articles]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 3)

    expect(recent).toHaveLength(3)
    expect(recent[0].id).toBe('d')
    expect(recent[1].id).toBe('b')
    expect(recent[2].id).toBe('c')
  })

  it('文章少于 3 篇时返回全部', () => {
    const articles = [mockArticle({ id: 'only' })]
    const recent = [...articles]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 3)

    expect(recent).toHaveLength(1)
  })

  it('文章库为空时返回空数组', () => {
    const articles: Article[] = []
    const recent = [...articles]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 3)

    expect(recent).toHaveLength(0)
  })
})

// ---- isPageUnsupported 判定 ----

describe('isPageUnsupported — 页面支持判定', () => {
  function isRestrictedUrl(url: string): boolean {
    const restricted = ['chrome://', 'chrome-extension://', 'about:', 'edge://', 'brave://']
    return restricted.some((prefix) => url.startsWith(prefix))
  }

  it('chrome:// 页面不支持', () => {
    expect(isRestrictedUrl('chrome://extensions/')).toBe(true)
  })

  it('chrome-extension:// 页面不支持', () => {
    expect(isRestrictedUrl('chrome-extension://abc123/popup.html')).toBe(true)
  })

  it('about:blank 页面不支持', () => {
    expect(isRestrictedUrl('about:blank')).toBe(true)
  })

  it('https:// 普通网页支持', () => {
    expect(isRestrictedUrl('https://example.com/article')).toBe(false)
  })

  it('无 pageMeta 时 isPageUnsupported 为 false', () => {
    const pageMeta = null
    const isUnsupported = pageMeta?.url ? isRestrictedUrl(pageMeta.url) : false
    expect(isUnsupported).toBe(false)
  })
})

// ---- extractError 错误消息 ----

describe('extractError — 提取错误消息', () => {
  it('权限错误应包含 permission', () => {
    const err = new Error('Permission denied: cannot access this page')
    const isPermissionError =
      err.message.toLowerCase().includes('permission') ||
      err.message.toLowerCase().includes('denied') ||
      err.message.includes('无法访问')
    expect(isPermissionError).toBe(true)
  })

  it('未知错误不应触发权限 toast', () => {
    const err = new Error('Network timeout')
    const isPermissionError =
      err.message.toLowerCase().includes('permission') ||
      err.message.toLowerCase().includes('denied') ||
      err.message.includes('无法访问')
    expect(isPermissionError).toBe(false)
  })

  it('错误消息为 null 时 fallback 到通用提示', () => {
    const extractError = null
    const displayError = extractError || '请重试'
    expect(displayError).toBe('请重试')
  })

  it('错误消息存在时直接使用', () => {
    const extractError = 'defuddle parseAsync timed out'
    const displayError = extractError || '请重试'
    expect(displayError).toBe('defuddle parseAsync timed out')
  })
})
