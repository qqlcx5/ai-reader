/**
 * M6 — search.worker.ts
 * Web Worker 全文检索：主线程通过 postMessage 传入查询，Worker 返回 SearchResult[]
 * 检索范围：Conversations 主表 title + Messages 副表 rawText + chatHistory
 * snippet 为命中词前后各 60 字符
 * 分批扫描副表，避免单次阻塞
 */

import Dexie, { type EntityTable } from 'dexie'
import type { ConversationRecord, MessageRecord } from '../lib/db/types'

export interface SearchResult {
  pageId: string
  title: string
  snippet: string
  matchType: 'title' | 'article' | 'chat'
  domain?: string
  favicon?: string
  updatedAt?: number
}

interface SearchRequest {
  query: string
  limit: number
}

// ─── 数据库（Worker 内独立实例） ─────────────────────────────────────────────

class WorkerDB extends Dexie {
  conversations!: EntityTable<ConversationRecord, 'id'>
  messages!: EntityTable<MessageRecord, 'id'>

  constructor() {
    super('ReadChatClipper')
    this.version(3).stores({
      conversations: 'id, url, domain, updatedAt, createdAt',
      messages: 'id',
    })
  }
}

const db = new WorkerDB()

// ─── 辅助函数 ─────────────────────────────────────────────────────────────────

function makeSnippet(text: string, query: string, contextLen = 60): string {
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return text.slice(0, 120)
  const start = Math.max(0, idx - contextLen)
  const end = Math.min(text.length, idx + query.length + contextLen)
  const prefix = start > 0 ? '…' : ''
  const suffix = end < text.length ? '…' : ''
  return prefix + text.slice(start, end) + suffix
}

// ─── 检索逻辑 ─────────────────────────────────────────────────────────────────

async function search(query: string, limit: number): Promise<SearchResult[]> {
  if (!query.trim()) return []

  const results: SearchResult[] = []
  const lowerQuery = query.toLowerCase()

  // 1. 主表 title 匹配（快速，< 5ms）
  const conversations = await db.conversations.toArray()
  for (const conv of conversations) {
    if (results.length >= limit) break
    if (conv.title.toLowerCase().includes(lowerQuery)) {
      results.push({
        pageId: conv.id,
        title: conv.title,
        snippet: makeSnippet(conv.title, query),
        matchType: 'title',
        domain: conv.domain,
        favicon: conv.favicon,
        updatedAt: conv.updatedAt,
      })
    }
  }

  // 已命中主表的 pageId 集合（避免重复）
  const titleHitIds = new Set(results.map((r) => r.pageId))

  // 2. 副表分批扫描（每批 20 条，避免单次长时间阻塞）
  const BATCH = 20
  const total = await db.messages.count()
  let offset = 0

  while (offset < total && results.length < limit) {
    const batch = await db.messages.offset(offset).limit(BATCH).toArray()
    offset += BATCH

    for (const msg of batch) {
      if (results.length >= limit) break

      // rawText 全文匹配
      if (!titleHitIds.has(msg.id) && msg.rawText?.toLowerCase().includes(lowerQuery)) {
        const conv = conversations.find((c) => c.id === msg.id)
        results.push({
          pageId: msg.id,
          title: conv?.title ?? msg.id,
          snippet: makeSnippet(msg.rawText, query),
          matchType: 'article',
          domain: conv?.domain,
          favicon: conv?.favicon,
          updatedAt: conv?.updatedAt,
        })
        titleHitIds.add(msg.id)
      }

      // chatHistory 对话内容匹配
      if (results.length < limit && msg.chatHistory) {
        for (const chatMsg of msg.chatHistory) {
          if (chatMsg.content?.toLowerCase().includes(lowerQuery)) {
            if (!titleHitIds.has(msg.id)) {
              const conv = conversations.find((c) => c.id === msg.id)
              results.push({
                pageId: msg.id,
                title: conv?.title ?? msg.id,
                snippet: makeSnippet(chatMsg.content, query),
                matchType: 'chat',
                domain: conv?.domain,
                favicon: conv?.favicon,
                updatedAt: conv?.updatedAt,
              })
              titleHitIds.add(msg.id)
            }
            break
          }
        }
      }
    }

    // 让出主线程（分批 yield）
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
  }

  return results
}

// ─── Worker 消息处理 ──────────────────────────────────────────────────────────

self.onmessage = async (e: MessageEvent<SearchRequest>) => {
  const { query, limit = 50 } = e.data
  try {
    const results = await search(query, limit)
    self.postMessage({ ok: true, results })
  } catch (err) {
    self.postMessage({ ok: false, error: String(err), results: [] })
  }
}
