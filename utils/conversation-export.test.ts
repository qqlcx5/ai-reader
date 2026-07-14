import { describe, it, expect, vi } from 'vitest'
import {
  formatMessageAsMarkdown,
  formatMessageForCopy,
  exportConversationAsMarkdown,
  exportConversationAsJson,
  exportConversationsToZip,
  exportConversationsAsJson,
  copyToClipboard,
} from './conversation-export'
import { unzipSync, strFromU8 } from 'fflate'
import type { ConversationEntity, ChatMessage } from '@/types/chat'
import type { DocumentEntity } from '@/types/document'

// ── Fixtures ───────────────────────────────────────────────

function makeMessage(over: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 'msg-1',
    role: 'user',
    content: 'Hello',
    status: 'success',
    createdAt: '2026-01-15T10:00:00Z',
    ...over,
  }
}

function makeConversation(over: Partial<ConversationEntity> = {}): ConversationEntity {
  return {
    id: 'conv-1',
    documentId: 'doc-1',
    title: '测试对话',
    messages: [
      makeMessage({ id: 'm1', role: 'user', content: '你好', createdAt: '2026-01-15T10:00:00Z' }),
      makeMessage({
        id: 'm2',
        role: 'assistant',
        content: '你好！有什么可以帮你的？',
        modelId: 'gpt-4o',
        status: 'success',
        reasoningContent: '让我思考一下用户的问题...',
        tokenUsage: { promptTokens: 100, completionTokens: 20, totalTokens: 120 },
        durationMs: 1500,
        createdAt: '2026-01-15T10:00:01Z',
      }),
    ],
    createdAt: '2026-01-15T10:00:00Z',
    updatedAt: '2026-01-15T10:01:00Z',
    ...over,
  }
}

function makeDoc(over: Partial<DocumentEntity> = {}): DocumentEntity {
  const now = '2026-01-15T00:00:00Z'
  return {
    id: 'doc-1',
    url: 'https://example.com/article',
    title: 'Test Article',
    markdown: '# Hello\n\nWorld',
    wordCount: 2,
    tokenCount: 3,
    contentHash: 'abc123',
    extractionMethod: 'defuddle',
    source: 'library',
    capturedAt: now,
    updatedAt: now,
    ...over,
  }
}

// ── Tests ──────────────────────────────────────────────────

describe('formatMessageAsMarkdown', () => {
  it('formats a user message with role label and timestamp', () => {
    const md = formatMessageAsMarkdown(makeMessage({ role: 'user', content: '你好' }))
    expect(md).toContain('🧑 用户')
    expect(md).toContain('你好')
    expect(md).toContain('2026-01-15')
  })

  it('formats an assistant message with model, thinking, and content', () => {
    const md = formatMessageAsMarkdown(
      makeMessage({
        role: 'assistant',
        content: '回答内容',
        modelId: 'gpt-4o',
        reasoningContent: '思考中...',
        tokenUsage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        durationMs: 2000,
      }),
    )
    expect(md).toContain('🤖 助手')
    expect(md).toContain('gpt-4o')
    expect(md).toContain('<details>')
    expect(md).toContain('思考中...')
    expect(md).toContain('回答内容')
    expect(md).toContain('Tokens:')
    expect(md).toContain('耗时:')
  })

  it('formats a system message', () => {
    const md = formatMessageAsMarkdown(makeMessage({ role: 'system', content: '系统指令' }))
    expect(md).toContain('⚙️ 系统')
    expect(md).toContain('系统指令')
  })

  it('includes error info for failed messages', () => {
    const md = formatMessageAsMarkdown(
      makeMessage({ role: 'assistant', content: '', status: 'failed', error: 'API timeout' }),
    )
    expect(md).toContain('❌ 失败')
    expect(md).toContain('API timeout')
  })

  it('includes aborted status', () => {
    const md = formatMessageAsMarkdown(
      makeMessage({ role: 'assistant', content: '部分内容', status: 'aborted' }),
    )
    expect(md).toContain('⏹️ 已停止')
  })

  it('handles empty content gracefully', () => {
    const md = formatMessageAsMarkdown(makeMessage({ role: 'user', content: '' }))
    expect(md).toContain('(空)')
  })
})

describe('formatMessageForCopy', () => {
  it('produces a compact markdown for clipboard', () => {
    const text = formatMessageForCopy(
      makeMessage({
        role: 'assistant',
        content: '回答',
        modelId: 'gpt-4o',
        reasoningContent: '思考',
      }),
    )
    expect(text).toContain('**🤖 助手**')
    expect(text).toContain('gpt-4o')
    expect(text).toContain('<details>')
    expect(text).toContain('思考')
    expect(text).toContain('回答')
  })

  it('omits thinking block when not present', () => {
    const text = formatMessageForCopy(
      makeMessage({ role: 'user', content: '问题' }),
    )
    expect(text).not.toContain('<details>')
    expect(text).toContain('**🧑 用户**')
    expect(text).toContain('问题')
  })
})

describe('exportConversationAsMarkdown', () => {
  it('produces a full Markdown document with header and messages', () => {
    const conv = makeConversation()
    const doc = makeDoc()
    const md = exportConversationAsMarkdown(conv, doc)

    expect(md).toContain('# 测试对话')
    expect(md).toContain('对话信息')
    expect(md).toContain('创建时间:')
    expect(md).toContain('消息数: 2')
    expect(md).toContain('关联文档')
    expect(md).toContain('Test Article')
    expect(md).toContain('🧑 用户')
    expect(md).toContain('你好')
    expect(md).toContain('🤖 助手')
    expect(md).toContain('你好！有什么可以帮你的？')
    expect(md).toContain('<details>')
    expect(md).toContain('让我思考一下')
  })

  it('respects includeDocMeta = false', () => {
    const conv = makeConversation()
    const doc = makeDoc()
    const md = exportConversationAsMarkdown(conv, doc, { includeDocMeta: false })

    expect(md).not.toContain('关联文档')
    expect(md).not.toContain('Test Article')
  })

  it('respects includeThinking = false', () => {
    const conv = makeConversation()
    const md = exportConversationAsMarkdown(conv, undefined, { includeThinking: false })

    expect(md).not.toContain('<details>')
    expect(md).not.toContain('让我思考一下')
  })

  it('respects includeMeta = false', () => {
    const conv = makeConversation()
    const md = exportConversationAsMarkdown(conv, undefined, { includeMeta: false })

    expect(md).not.toContain('Tokens:')
    expect(md).not.toContain('耗时:')
  })

  it('works without a document', () => {
    const conv = makeConversation()
    const md = exportConversationAsMarkdown(conv)
    expect(md).toContain('# 测试对话')
    expect(md).not.toContain('关联文档')
  })

  it('handles conversation with no messages', () => {
    const conv = makeConversation({ messages: [] })
    const md = exportConversationAsMarkdown(conv)
    expect(md).toContain('消息数: 0')
  })
})

describe('exportConversationAsJson', () => {
  it('produces valid JSON with conversation + document + messages', () => {
    const conv = makeConversation()
    const doc = makeDoc()
    const json = exportConversationAsJson(conv, doc)
    const parsed = JSON.parse(json)

    expect(parsed.conversation.id).toBe('conv-1')
    expect(parsed.conversation.title).toBe('测试对话')
    expect(parsed.document.title).toBe('Test Article')
    expect(parsed.messages).toHaveLength(2)
    expect(parsed.messages[0].role).toBe('user')
    expect(parsed.messages[1].reasoningContent).toBe('让我思考一下用户的问题...')
    expect(parsed.messages[1].tokenUsage.totalTokens).toBe(120)
  })

  it('produces valid JSON without document', () => {
    const conv = makeConversation()
    const json = exportConversationAsJson(conv)
    const parsed = JSON.parse(json)

    expect(parsed.document).toBeNull()
    expect(parsed.messages).toHaveLength(2)
  })
})

describe('exportConversationsToZip', () => {
  it('creates a ZIP with one .md per conversation + index.md', () => {
    const convs = [
      makeConversation({ id: 'c1', title: '对话一', createdAt: '2026-01-15T10:00:00Z' }),
      makeConversation({ id: 'c2', title: '对话二', createdAt: '2026-01-16T10:00:00Z' }),
    ]
    const docs = new Map([['doc-1', makeDoc({ title: 'My Doc' })]])

    const blob = exportConversationsToZip(convs, docs)
    expect(blob.type).toBe('application/zip')

    return blob.arrayBuffer().then((buf) => {
      const files = unzipSync(new Uint8Array(buf))
      const names = Object.keys(files)
      expect(names).toContain('index.md')
      // Files should be under "My Doc/" folder
      expect(names.some((n) => n.startsWith('My Doc/') && n.endsWith('.md'))).toBe(true)

      const indexContent = strFromU8(files['index.md'])
      expect(indexContent).toContain('对话导出索引')
      expect(indexContent).toContain('对话数量: 2')
      expect(indexContent).toContain('对话一')
      expect(indexContent).toContain('对话二')
    })
  })

  it('filters by documentIds', () => {
    const convs = [
      makeConversation({ id: 'c1', documentId: 'doc-a', title: 'A 对话' }),
      makeConversation({ id: 'c2', documentId: 'doc-b', title: 'B 对话' }),
    ]
    const docs = new Map([
      ['doc-a', makeDoc({ id: 'doc-a', title: 'Doc A' })],
      ['doc-b', makeDoc({ id: 'doc-b', title: 'Doc B' })],
    ])

    const blob = exportConversationsToZip(convs, docs, { documentIds: ['doc-a'] })
    return blob.arrayBuffer().then((buf) => {
      const files = unzipSync(new Uint8Array(buf))
      const names = Object.keys(files)
      // Should have index.md + 1 conversation file (under Doc A/)
      expect(names.some((n) => n.startsWith('Doc A/'))).toBe(true)
      expect(names.some((n) => n.startsWith('Doc B/'))).toBe(false)
    })
  })

  it('filters by time range', () => {
    const convs = [
      makeConversation({ id: 'c1', title: '旧', createdAt: '2026-01-01T00:00:00Z' }),
      makeConversation({ id: 'c2', title: '新', createdAt: '2026-06-01T00:00:00Z' }),
    ]
    const docs = new Map([['doc-1', makeDoc()]])

    const fromMs = new Date('2026-03-01').getTime()
    const blob = exportConversationsToZip(convs, docs, { fromMs })
    return blob.arrayBuffer().then((buf) => {
      const files = unzipSync(new Uint8Array(buf))
      const indexContent = strFromU8(files['index.md'])
      expect(indexContent).toContain('对话数量: 1')
      expect(indexContent).toContain('新')
      expect(indexContent).not.toContain('旧')
    })
  })

  it('handles empty conversation list', () => {
    const blob = exportConversationsToZip([], new Map())
    return blob.arrayBuffer().then((buf) => {
      const files = unzipSync(new Uint8Array(buf))
      const names = Object.keys(files)
      // Empty zip when no conversations
      expect(names).toEqual([])
    })
  })

  it('deduplicates filenames when titles collide', () => {
    const convs = [
      makeConversation({ id: 'c1', title: '同标题', createdAt: '2026-01-15T10:00:00Z' }),
      makeConversation({ id: 'c2', title: '同标题', createdAt: '2026-01-16T10:00:00Z' }),
    ]
    const docs = new Map([['doc-1', makeDoc({ title: 'SameDoc' })]])

    const blob = exportConversationsToZip(convs, docs)
    return blob.arrayBuffer().then((buf) => {
      const files = unzipSync(new Uint8Array(buf))
      const names = Object.keys(files).filter((n) => n !== 'index.md')
      expect(names).toHaveLength(2)
      expect(names[0]).not.toBe(names[1])
    })
  })
})

describe('exportConversationsAsJson', () => {
  it('produces a JSON string with all conversations and messages', () => {
    const convs = [
      makeConversation({ id: 'c1', title: '对话一' }),
      makeConversation({ id: 'c2', title: '对话二' }),
    ]
    const docs = new Map([['doc-1', makeDoc()]])

    const json = exportConversationsAsJson(convs, docs)
    const parsed = JSON.parse(json)

    expect(parsed.count).toBe(2)
    expect(parsed.conversations).toHaveLength(2)
    expect(parsed.conversations[0].conversation.title).toBe('对话一')
    expect(parsed.conversations[0].document.title).toBe('Test Article')
    expect(parsed.conversations[0].messages).toHaveLength(2)
  })

  it('filters by documentIds', () => {
    const convs = [
      makeConversation({ id: 'c1', documentId: 'doc-a' }),
      makeConversation({ id: 'c2', documentId: 'doc-b' }),
    ]
    const docs = new Map([
      ['doc-a', makeDoc({ id: 'doc-a' })],
      ['doc-b', makeDoc({ id: 'doc-b' })],
    ])

    const json = exportConversationsAsJson(convs, docs, { documentIds: ['doc-b'] })
    const parsed = JSON.parse(json)

    expect(parsed.count).toBe(1)
    expect(parsed.conversations[0].conversation.documentId).toBe('doc-b')
  })
})

describe('copyToClipboard', () => {
  it('uses navigator.clipboard when available', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    vi.stubGlobal('window', { isSecureContext: true })

    const ok = await copyToClipboard('test text')
    expect(ok).toBe(true)
    expect(writeText).toHaveBeenCalledWith('test text')

    vi.unstubAllGlobals()
  })

  it('falls back to execCommand when clipboard API unavailable', async () => {
    vi.stubGlobal('navigator', { clipboard: undefined })
    vi.stubGlobal('window', { isSecureContext: false })

    const ok = await copyToClipboard('fallback text')
    // In jsdom execCommand may return false, but it shouldn't throw
    expect(typeof ok).toBe('boolean')

    vi.unstubAllGlobals()
  })
})
