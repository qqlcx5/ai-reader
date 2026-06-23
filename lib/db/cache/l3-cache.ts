/**
 * M8 三级缓存 — L3 API 响应缓存（IndexedDB，Content Hash）
 *
 * 存储：l3Cache 表（在 ReadChatDB 内）
 * Key：SHA-256(pageId + prompt + model)
 * 值：LLM 完整响应文本
 *
 * 命中效果：ChatMessage.cached = true，底栏显示 "⚡ Cached"
 *
 * 注意：无 TTL（缓存永久有效直到用户手动清除或重新提问时覆盖）
 */

import { getDb } from '../database'
import type { L3CacheEntry } from '../types'

export class L3Cache {
  private get table() {
    return getDb().l3Cache
  }

  /** 计算内容哈希 Key */
  static async computeHash(pageId: string, prompt: string, model: string): Promise<string> {
    const input = `${pageId}\x00${prompt}\x00${model}`
    const encoder = new TextEncoder()
    const data = encoder.encode(input)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
  }

  /** 按 hash 查询缓存 */
  async get(hash: string): Promise<string | null> {
    const entry = await this.table.where('hash').equals(hash).first()
    return entry?.responseText ?? null
  }

  /** 写入缓存（upsert） */
  async set(hash: string, responseText: string): Promise<void> {
    const entry: L3CacheEntry = {
      id: hash, // 以 hash 作为主键
      hash,
      responseText,
      createdAt: Date.now(),
    }
    await this.table.put(entry)
  }

  /** 删除指定 hash 的缓存 */
  async delete(hash: string): Promise<void> {
    await this.table.where('hash').equals(hash).delete()
  }

  /** 清除全部 L3 缓存（用户手动清除接口） */
  async clearAll(): Promise<void> {
    await this.table.clear()
  }

  async count(): Promise<number> {
    return this.table.count()
  }
}

export const l3Cache = new L3Cache()

/**
 * 便捷工厂：构建缓存 key 并查询（组合 L3Cache.computeHash + l3Cache.get）
 */
export async function getCachedApiResponse(
  pageId: string,
  prompt: string,
  model: string,
): Promise<string | null> {
  const hash = await L3Cache.computeHash(pageId, prompt, model)
  return l3Cache.get(hash)
}

/**
 * 便捷写入：计算 hash 并缓存（组合 L3Cache.computeHash + l3Cache.set）
 */
export async function setCachedApiResponse(
  pageId: string,
  prompt: string,
  model: string,
  responseText: string,
): Promise<string> {
  const hash = await L3Cache.computeHash(pageId, prompt, model)
  await l3Cache.set(hash, responseText)
  return hash
}
