import { describe, it, expect } from 'vitest'
import type { Article } from '@/domain'

// ============================================================
// LibraryView — 纯逻辑单元测试
//
// 测试过滤函数、排序函数、空状态判定，不依赖 Vue 组件挂载。
// ============================================================

/** 模拟 createMockArticle 工厂 */
function createMockArticle(overrides: Partial<Article> = {}): Article {
  return {
    id: 'id-1',
    title: 'Test Article',
    url: 'https://example.com/test',
    siteName: 'Example Site',
    siteLetter: 'E',
    author: 'John Doe',
    publishedAt: '2026-01-01',
    createdAt: '2026-06-01T12:00:00Z',
    updatedAt: '2026-06-01T12:00:00Z',
    excerpt: 'A test article excerpt',
    markdown: '# Test\n\nThis is a test.',
    ...overrides,
  }
}

/** 过滤函数：模拟 LibraryView 的 includes 过滤逻辑 */
function filterArticles(
  articles: Article[],
  keyword: string,
): Article[] {
  const sorted = [...articles].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )
  const q = keyword.trim().toLowerCase()
  if (!q) return sorted
  return sorted.filter((a) => {
    const fields = [a.title, a.siteName ?? '', a.author ?? '', a.excerpt ?? '']
    return fields.some((f) => f.toLowerCase().includes(q))
  })
}

/** 搜索是否有结果 */
function isSearchEmpty(articles: Article[], keyword: string): boolean {
  return keyword.trim().length > 0 && filterArticles(articles, keyword).length === 0
}

/** 文章库是否为空 */
function isLibraryEmpty(articles: Article[], keyword: string): boolean {
  return articles.length === 0 && !keyword.trim()
}

// ============================================================
// 搜索测试
// ============================================================

describe('filterArticles — 搜索过滤', () => {
  const articles: Article[] = [
    createMockArticle({ id: '1', title: 'Vue 3 Guide', siteName: 'Vue.js', author: 'Evan You', createdAt: '2026-06-03T00:00:00Z' }),
    createMockArticle({ id: '2', title: 'React 19 Overview', siteName: 'React Blog', author: 'Dan Abramov', createdAt: '2026-06-01T00:00:00Z' }),
    createMockArticle({ id: '3', title: 'TypeScript Handbook', siteName: 'Microsoft', author: 'Anders Hejlsberg', createdAt: '2026-06-02T00:00:00Z' }),
  ]

  it('空关键词应返回全部文章（按创建时间降序）', () => {
    const result = filterArticles(articles, '')
    expect(result).toHaveLength(3)
    expect(result[0].id).toBe('1') // 最新
    expect(result[1].id).toBe('3')
    expect(result[2].id).toBe('2') // 最旧
  })

  it('按标题搜索', () => {
    const result = filterArticles(articles, 'vue')
    expect(result).toHaveLength(1)
    expect(result[0].title).toContain('Vue')
  })

  it('按作者搜索', () => {
    const result = filterArticles(articles, 'dan')
    expect(result).toHaveLength(1)
    expect(result[0].author).toBe('Dan Abramov')
  })

  it('按站点名搜索', () => {
    const result = filterArticles(articles, 'microsoft')
    expect(result).toHaveLength(1)
    expect(result[0].siteName).toBe('Microsoft')
  })

  it('按摘要搜索', () => {
    const articlesWithExcerpt = [
      createMockArticle({
        id: '10',
        title: 'Some Article',
        excerpt: 'deep learning tutorial',
        createdAt: '2026-06-01T00:00:00Z',
      }),
    ]
    const result = filterArticles(articlesWithExcerpt, 'deep learning')
    expect(result).toHaveLength(1)
    expect(result[0].excerpt).toContain('deep learning')
  })

  it('搜索不匹配应返回空数组', () => {
    const result = filterArticles(articles, 'nonexistent')
    expect(result).toHaveLength(0)
  })

  it('搜索应大小写不敏感', () => {
    const result = filterArticles(articles, 'VUE')
    expect(result).toHaveLength(1)
    expect(result[0].title).toContain('Vue')
  })

  it('不搜索 markdown 字段', () => {
    const articlesWithMarkdown = [
      createMockArticle({
        id: '20',
        title: 'Plain Title',
        siteName: '',
        author: '',
        excerpt: '',
        markdown: '# Secret keyword here',
        createdAt: '2026-06-01T00:00:00Z',
      }),
    ]
    // keyword 在 markdown 中，但不在 title/siteName/author/excerpt 中
    const result = filterArticles(articlesWithMarkdown, 'secret')
    expect(result).toHaveLength(0)
  })
})

// ============================================================
// 空状态测试
// ============================================================

describe('空状态判定', () => {
  it('搜索无结果时应判定为搜索空状态', () => {
    const articles = [createMockArticle({ id: '1' })]
    expect(isSearchEmpty(articles, 'nonexistent')).toBe(true)
  })

  it('有关键词但有结果时不应判定为空状态', () => {
    const articles = [createMockArticle({ id: '1', title: 'Test' })]
    expect(isSearchEmpty(articles, 'test')).toBe(false)
  })

  it('无关键词时空关键词不算搜索空状态', () => {
    const articles = [createMockArticle({ id: '1' })]
    expect(isSearchEmpty(articles, '')).toBe(false)
  })

  it('文章库为空且无搜索关键词时应判定为库空状态', () => {
    expect(isLibraryEmpty([], '')).toBe(true)
  })

  it('文章库为空但正在搜索时不判定为库空状态', () => {
    expect(isLibraryEmpty([], 'something')).toBe(false)
  })

  it('文章库非空时不应判定为库空状态', () => {
    const articles = [createMockArticle({ id: '1' })]
    expect(isLibraryEmpty(articles, '')).toBe(false)
  })
})

// ============================================================
// 排序测试
// ============================================================

describe('按 createdAt 降序排列', () => {
  it('应把最新创建的文章排在最前面', () => {
    const articles: Article[] = [
      createMockArticle({ id: 'old', createdAt: '2026-01-01T00:00:00Z' }),
      createMockArticle({ id: 'mid', createdAt: '2026-03-15T00:00:00Z' }),
      createMockArticle({ id: 'new', createdAt: '2026-06-27T00:00:00Z' }),
    ]
    const result = filterArticles(articles, '')
    expect(result[0].id).toBe('new')
    expect(result[1].id).toBe('mid')
    expect(result[2].id).toBe('old')
  })
})
