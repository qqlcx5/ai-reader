/**
 * M8 存储与数据层 — Messages 副表 Repository
 *
 * 副表存完整内容（rawText、metadata、chatHistory），仅按 ID 懒加载。
 * 严禁提供批量扫描接口（防止在列表页误用）。
 */

import { getDb } from '../database'
import type { MessageRecord, ChatMessage } from '../types'

export class MessageRepository {
  private get table() {
    return getDb().messages
  }

  /** upsert：不存在则新建，存在则覆盖 */
  async save(record: MessageRecord): Promise<void> {
    await this.table.put(record)
  }

  /** 懒加载：仅按 ID 查询，不暴露批量扫描 */
  async loadById(id: string): Promise<MessageRecord | undefined> {
    return this.table.get(id)
  }

  /**
   * 追加单条消息到 chatHistory。
   * 若记录不存在则静默跳过（调用方应先确保 ConversationRecord 存在）。
   */
  async appendMessage(id: string, msg: ChatMessage): Promise<void> {
    const record = await this.table.get(id)
    if (!record) return
    await this.table.update(id, {
      chatHistory: [...record.chatHistory, msg],
    })
  }

  /** 删除 chatHistory 中的单条消息 */
  async deleteMessage(id: string, msgId: string): Promise<void> {
    const record = await this.table.get(id)
    if (!record) return
    await this.table.update(id, {
      chatHistory: record.chatHistory.filter((m) => m.id !== msgId),
    })
  }

  /**
   * 截断：删除 msgId 之后（不含）的所有消息。
   * 用于"在某条消息处重新生成"场景。
   */
  async truncateAfter(id: string, msgId: string): Promise<void> {
    const record = await this.table.get(id)
    if (!record) return
    const idx = record.chatHistory.findIndex((m) => m.id === msgId)
    if (idx === -1) return
    await this.table.update(id, {
      chatHistory: record.chatHistory.slice(0, idx + 1),
    })
  }

  async delete(id: string): Promise<void> {
    await this.table.delete(id)
  }

  /** 批量写入（用于导入恢复） */
  async bulkPut(records: MessageRecord[]): Promise<void> {
    await this.table.bulkPut(records)
  }
}

export const messageRepo = new MessageRepository()
