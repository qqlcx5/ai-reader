import dayjs from 'dayjs'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { PromptTemplateRepository } from '../db/repositories/prompt-template.repository'
import type { PromptTemplate } from '../types/prompt-template'

const INITIAL_TEMPLATES: Omit<PromptTemplate, 'id' | 'createdAt'>[] = [
  {
    title: '专家圆桌分析',
    content: `找出这个星球上对该问题最懂的那些人，化身他们请用“专家圆桌”的方式呈现部分分析。`,
    category: '模板',
    isBuiltin: false,
    sortOrder: 8,
  },
  {
    title: '反方视角',
    content: `请站在批判者和对立立场审视以上内容。要求：
1. 提出 3-5 个有力的反驳论点
2. 指出作者可能忽略的替代方案或相反案例
3. 如果文章有数据，质疑数据来源和解读方式
4. 总结：如果让你和作者辩论，你的开场陈述是什么？`,
    category: '模板',
    isBuiltin: false,
    sortOrder: 9,
  },
  {
    title: '行动清单',
    content: `请从以上内容中提取所有可执行的行动项，按优先级分为三档：

## 立即做（本周内）
- [ ] ...
## 规划中（本月内）
- [ ] ...
## 待关注（长期）
- [ ] ...

每个行动项需具体、可检验完成标准。如果原文没有明确行动项，请基于内容推断合理的最优下一步。`,
    category: '模板',
    isBuiltin: false,
    sortOrder: 10,
  },
  {
    title: '对比表格',
    content: `请将以上内容中的对比信息整理为 Markdown 表格。要求：
1. 列名：维度 | 方案/观点A | 方案/观点B | 评价
2. 至少覆盖 5 个对比维度
3. "评价"列给出你的判断（A 更优/B 更优/各有优劣/取决于场景）
4. 表格下方用 2-3 句话总结关键差异`,
    category: '模板',
    isBuiltin: false,
    sortOrder: 11,
  },
  {
    title: '费曼讲解',
    content: `请用费曼学习法的方式讲解以上内容的核心概念。要求：
1. 假设读者完全不懂该领域，避免任何专业术语
2. 用日常生活中的类比来解释（比如"就像..."）
3. 先一句话讲清楚"这到底是什么"，再展开
4. 最后设计一个简单的小问题检验读者是否真正理解了`,
    category: '模板',
    isBuiltin: false,
    sortOrder: 12,
  },
]

export const usePromptTemplateStore = defineStore('promptTemplate', () => {
  const templates = ref<PromptTemplate[]>([])
  const loaded = ref(false)

  async function initTemplates(): Promise<void> {
    if (loaded.value) return

    const all = await PromptTemplateRepository.findAll()
    templates.value = all

    if (all.length === 0) {
      const now = dayjs().toISOString()
      const initials: PromptTemplate[] = INITIAL_TEMPLATES.map((t) => ({
        ...t,
        id: `tpl_${crypto.randomUUID()}`,
        createdAt: now,
      }))
      for (const t of initials) {
        await PromptTemplateRepository.save(t)
      }
      templates.value = initials
    }

    loaded.value = true
  }

  async function addTemplate(
    title: string,
    content: string,
    category: string,
  ): Promise<PromptTemplate> {
    const now = dayjs().toISOString()
    const maxSort = templates.value.reduce(
      (max, t) => Math.max(max, t.sortOrder),
      0,
    )
    const template: PromptTemplate = {
      id: `tpl_${crypto.randomUUID()}`,
      title,
      content,
      category: category || '自定义',
      isBuiltin: false,
      sortOrder: maxSort + 1,
      createdAt: now,
    }
    await PromptTemplateRepository.save(template)
    templates.value.push(template)
    return template
  }

  async function updateTemplate(
    id: string,
    updates: Partial<Pick<PromptTemplate, 'title' | 'content' | 'category'>>,
  ): Promise<void> {
    const template = templates.value.find((t) => t.id === id)
    if (!template) return
    Object.assign(template, updates)
    await PromptTemplateRepository.save(template)
  }

  async function deleteTemplate(id: string): Promise<void> {
    await PromptTemplateRepository.delete(id)
    templates.value = templates.value.filter((t) => t.id !== id)
  }

  return {
    templates,
    loaded,
    initTemplates,
    addTemplate,
    updateTemplate,
    deleteTemplate,
  }
})
