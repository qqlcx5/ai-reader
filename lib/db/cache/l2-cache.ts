/**
 * M8 三级缓存 — L2 持久化缓存（IndexedDB，TTL 24h）
 *
 * 存储：l2Cache 表（在 ReadChatDB 内）
 * Key：pageId（URL 的 SHA-256 哈希）
 * 值：ExtractionResult + 过期时间
 * TTL：默认 86400000ms（24h）
 *
 * 命中条件：expiresAt > Date.now()
 * 命中效果：跳过 Readability / Defuddle 提取，节省 2～8s
 */

import { getDb } from '../database'
import type { ExtractionResult, L2CacheEntry } from '../types'

const DEFAULT_TTL_MS = 86_400_000 // 24h

export class L2Cache {
  private get table() {
    return getDb().l2Cache
  }

  /** 读取缓存，校验 TTL；过期返回 null */
  async get(pageId: string): Promise<ExtractionResult | null> {
    const entry = await this.table.where('pageId').equals(pageId).first()
    if (!entry) return null
    if (Date.now() > entry.expiresAt) {
      // 过期，异步删除
      void this.table.delete(entry.id)
      return null
    }
    return entry.data
  }

  /** 写入缓存（upsert） */
  async set(pageId: string, result: ExtractionResult, ttlMs = DEFAULT_TTL_MS): Promise<void> {
    const now = Date.now()
    const entry: L2CacheEntry = {
      id: pageId, // 以 pageId 作为主键，确保同一页面只有一条记录
      pageId,
      data: result,
      createdAt: now,
      expiresAt: now + ttlMs,
    }
    await this.table.put(entry)
  }

  /** 删除指定 pageId 的缓存 */
  async delete(pageId: string): Promise<void> {
    await this.table.where('pageId').equals(pageId).delete()
  }

  /** 清除所有已过期条目（可定期调用） */
  async evictExpired(): Promise<number> {
    const now = Date.now()
    return this.table.where('expiresAt').below(now).delete()
  }

  /** 清除全部 L2 缓存 */
  async clearAll(): Promise<void> {
    await this.table.clear()
  }

  async count(): Promise<number> {
    return this.table.count()
  }
}

export const l2Cache = new L2Cache()
