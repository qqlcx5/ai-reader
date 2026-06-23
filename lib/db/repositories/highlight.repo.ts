/**
 * M8 存储与数据层 — Highlights 高亮选区 Repository
 */

import { getDb } from '../database'
import type { HighlightRecord } from '../types'

export class HighlightRepository {
  private get table() {
    return getDb().highlights
  }

  async saveHighlight(record: HighlightRecord): Promise<void> {
    await this.table.put(record)
  }

  async listByPageId(pageId: string): Promise<HighlightRecord[]> {
    return this.table.where('pageId').equals(pageId).sortBy('createdAt')
  }

  async listByDomain(domain: string): Promise<HighlightRecord[]> {
    return this.table.where('domain').equals(domain).sortBy('createdAt')
  }

  async deleteByPageId(pageId: string): Promise<void> {
    await this.table.where('pageId').equals(pageId).delete()
  }

  /** 按域名导出（用于 .json 导出功能） */
  async exportByDomain(domain: string): Promise<HighlightRecord[]> {
    return this.table.where('domain').equals(domain).sortBy('createdAt')
  }

  async delete(id: string): Promise<void> {
    await this.table.delete(id)
  }

  async count(): Promise<number> {
    return this.table.count()
  }
}

export const highlightRepo = new HighlightRepository()
