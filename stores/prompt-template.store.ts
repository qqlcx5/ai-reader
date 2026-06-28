import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { PromptTemplateRepository } from '../db/repositories/prompt-template.repository'
import type { PromptTemplate } from '../types/prompt-template'

const BUILTIN_TEMPLATES: Omit<PromptTemplate, 'id' | 'createdAt'>[] = [
  {
    title: '快速总结',
    content: '请用 3-5 句话总结以上内容的核心要点。',
    category: '内置',
    isBuiltin: true,
    sortOrder: 0,
  },
  {
    title: '提取金句',
    content: '从以上内容中提取最有价值的 5-10 条金句或核心观点，按重要性排序。',
    category: '内置',
    isBuiltin: true,
    sortOrder: 1,
  },
  {
    title: '生成 Obsidian 卡片',
    content: '将以上内容整理为 Obsidian 笔记卡片格式，使用 YAML frontmatter、标签、双向链接。',
    category: '内置',
    isBuiltin: true,
    sortOrder: 2,
  },
  {
    title: '翻译为英文',
    content: '请将以上内容翻译为地道流畅的英文，保持原文风格与语气。',
    category: '内置',
    isBuiltin: true,
    sortOrder: 3,
  },
  {
    title: '解释核心概念',
    content: '解释以上内容中涉及的核心概念，用通俗易懂的语言说明，必要时给出例子。',
    category: '内置',
    isBuiltin: true,
    sortOrder: 4,
  },
  {
    title: '列出关键论点',
    content: '列出以上内容中的所有关键论点，按逻辑关系归类，用简洁的列表形式呈现。',
    category: '内置',
    isBuiltin: true,
    sortOrder: 5,
  },
  {
    title: '改写为更简洁的表达',
    content: '请将以上内容改写为更简洁的表达，保留核心信息，压缩至原文的 50% 以内。',
    category: '内置',
    isBuiltin: true,
    sortOrder: 6,
  },
  {
    title: '生成思维导图大纲',
    content: '将以上内容的结构梳理为思维导图大纲，使用缩进层级表示，方便导入 XMind 或 Markmap。',
    category: '内置',
    isBuiltin: true,
    sortOrder: 7,
  },
]

export const usePromptTemplateStore = defineStore('promptTemplate', () => {
  const templates = ref<PromptTemplate[]>([])
  const loaded = ref(false)

  const builtinTemplates = computed(() =>
    templates.value.filter((t) => t.isBuiltin),
  )

  const customTemplates = computed(() =>
    templates.value.filter((t) => !t.isBuiltin),
  )

  async function ensureBuiltinTemplates(): Promise<void> {
    const all = await PromptTemplateRepository.findAll()
    if (all.some((t) => t.isBuiltin)) return

    const now = new Date().toISOString()
    const builtins: PromptTemplate[] = BUILTIN_TEMPLATES.map((t) => ({
      ...t,
      id: `builtin_${crypto.randomUUID()}`,
      createdAt: now,
    }))
    for (const t of builtins) {
      await PromptTemplateRepository.save(t)
    }
    templates.value = [...builtins, ...templates.value]
  }

  async function initBuiltinTemplates(): Promise<void> {
    if (loaded.value) {
      await ensureBuiltinTemplates()
      return
    }

    const all = await PromptTemplateRepository.findAll()
    templates.value = all

    if (all.length === 0) {
      const now = new Date().toISOString()
      const builtins: PromptTemplate[] = BUILTIN_TEMPLATES.map((t) => ({
        ...t,
        id: `builtin_${crypto.randomUUID()}`,
        createdAt: now,
      }))
      for (const t of builtins) {
        await PromptTemplateRepository.save(t)
      }
      templates.value = builtins
    }

    await ensureBuiltinTemplates()
    loaded.value = true
  }

  async function addTemplate(
    title: string,
    content: string,
    category: string,
  ): Promise<PromptTemplate> {
    const now = new Date().toISOString()
    const maxSort = templates.value.reduce(
      (max, t) => Math.max(max, t.sortOrder),
      0,
    )
    const template: PromptTemplate = {
      id: `custom_${crypto.randomUUID()}`,
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
    if (!template || template.isBuiltin) return
    Object.assign(template, updates)
    await PromptTemplateRepository.save(template)
  }

  async function deleteTemplate(id: string): Promise<void> {
    const template = templates.value.find((t) => t.id === id)
    if (!template || template.isBuiltin) return
    await PromptTemplateRepository.delete(id)
    templates.value = templates.value.filter((t) => t.id !== id)
  }

  return {
    templates,
    builtinTemplates,
    customTemplates,
    loaded,
    initBuiltinTemplates,
    addTemplate,
    updateTemplate,
    deleteTemplate,
  }
})
