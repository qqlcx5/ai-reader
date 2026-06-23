/**
 * M8 存储与数据层 — Templates 提示词模板 Repository
 */

import { getDb } from '../database'
import type { TemplateRecord } from '../types'

/** 6 个内置默认模板（首次安装写入，跳过已存在） */
const DEFAULT_TEMPLATES: TemplateRecord[] = [
  {
    id: 'builtin-summary',
    name: '总结',
    icon: '📝',
    prompt: '请用简洁的中文总结以下内容的核心观点，控制在 200 字以内：\n\n{{content}}',
    createdAt: 0,
  },
  {
    id: 'builtin-translate-en',
    name: '翻译为英文',
    icon: '🌐',
    prompt: 'Please translate the following content into English:\n\n{{content}}',
    createdAt: 0,
  },
  {
    id: 'builtin-explain',
    name: '解释',
    icon: '💡',
    prompt: '请用通俗易懂的语言解释以下内容，适合初学者理解：\n\n{{content}}',
    createdAt: 0,
  },
  {
    id: 'builtin-critique',
    name: '批判性分析',
    icon: '🔍',
    prompt: '请对以下内容进行批判性分析，指出其逻辑漏洞、论据不足或可改进之处：\n\n{{content}}',
    createdAt: 0,
  },
  {
    id: 'builtin-mindmap',
    name: '思维导图',
    icon: '🗺️',
    prompt: '请将以下内容整理成 Markdown 格式的思维导图结构（用缩进列表表示层级）：\n\n{{content}}',
    createdAt: 0,
  },
  {
    id: 'builtin-qa',
    name: '问题生成',
    icon: '❓',
    prompt: '请根据以下内容生成 5 个有深度的问题，帮助读者深入思考：\n\n{{content}}',
    createdAt: 0,
  },
]

export class TemplateRepository {
  private get table() {
    return getDb().templates
  }

  /** 首次安装时写入内置模板，已存在的跳过 */
  async seedDefaultTemplates(): Promise<void> {
    const now = Date.now()
    for (const tpl of DEFAULT_TEMPLATES) {
      const exists = await this.table.get(tpl.id)
      if (!exists) {
        await this.table.add({ ...tpl, createdAt: now })
      }
    }
  }

  async create(record: TemplateRecord): Promise<void> {
    await this.table.add(record)
  }

  async update(id: string, partial: Partial<TemplateRecord>): Promise<void> {
    await this.table.update(id, partial)
  }

  async delete(id: string): Promise<void> {
    await this.table.delete(id)
  }

  async listAll(): Promise<TemplateRecord[]> {
    return this.table.orderBy('createdAt').toArray()
  }

  async findById(id: string): Promise<TemplateRecord | undefined> {
    return this.table.get(id)
  }

  /**
   * 按 URL 正则匹配模板（用于自动触发规则）。
   * 遍历所有模板的 urlPattern，返回第一个匹配项。
   */
  async matchByUrl(url: string): Promise<TemplateRecord | null> {
    const all = await this.table.toArray()
    for (const tpl of all) {
      if (!tpl.urlPattern) continue
      try {
        const re = new RegExp(tpl.urlPattern)
        if (re.test(url)) return tpl
      } catch {
        // 忽略无效正则
      }
    }
    return null
  }

  /** 按 Schema.org 类型匹配模板 */
  async matchBySchema(schemaType: string): Promise<TemplateRecord | null> {
    const all = await this.table.toArray()
    return all.find((t) => t.schemaType === schemaType) ?? null
  }
}

export const templateRepo = new TemplateRepository()
