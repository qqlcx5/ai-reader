/**
 * M8 存储与数据层 — Conversations 主表 Repository
 *
 * 主表只存元数据（id, url, domain, updatedAt 等），严禁存正文 / 对话历史。
 * 删除时级联清理副表 Messages 与 Highlights。
 */

import { getDb } from '../database'
import type { ConversationRecord, ConversationListOptions } from '../types'

export class ConversationRepository {
  private get table() {
    return getDb().conversations
  }

  async create(record: ConversationRecord): Promise<void> {
    await this.table.add(record)
  }

  async findById(id: string): Promise<ConversationRecord | undefined> {
    return this.table.get(id)
  }

  async list(options: ConversationListOptions): Promise<ConversationRecord[]> {
    const { sortBy, limit, offset } = options
    if (sortBy === 'domain') {
      return this.table.orderBy('domain').offset(offset).limit(limit).toArray()
    }
    // 默认按 updatedAt 倒序（最近更新在前）
    return this.table.orderBy('updatedAt').reverse().offset(offset).limit(limit).toArray()
  }

  async update(id: string, partial: Partial<ConversationRecord>): Promise<void> {
    await this.table.update(id, {
      ...partial,
      updatedAt: Date.now(),
    })
  }

  /**
   * 删除主表记录，同时级联删除副表 Messages 和 Highlights。
   */
  async delete(id: string): Promise<void> {
    const db = getDb()
    await db.transaction('rw', db.conversations, db.messages, db.highlights, async () => {
      await db.conversations.delete(id)
      await db.messages.delete(id)
      await db.highlights.where('pageId').equals(id).delete()
    })
  }

  async count(): Promise<number> {
    return this.table.count()
  }

  /** 按 domain 过滤（用于域名分组视图） */
  async listByDomain(domain: string): Promise<ConversationRecord[]> {
    return this.table.where('domain').equals(domain).sortBy('updatedAt')
  }

  /** 批量写入（用于导入恢复） */
  async bulkPut(records: ConversationRecord[]): Promise<void> {
    await this.table.bulkPut(records)
  }
}

export const conversationRepo = new ConversationRepository()
