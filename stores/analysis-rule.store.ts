import dayjs from 'dayjs'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { AnalysisRuleRepository } from '@/db/repositories/analysis-rule.repository'
import type { AnalysisRuleEntity } from '@/types/analysis-rule'

function uuid(): string {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

export const useAnalysisRuleStore = defineStore('analysis-rule', () => {
  const rules = ref<AnalysisRuleEntity[]>([])

  async function load() {
    rules.value = await AnalysisRuleRepository.findAll()
  }

  async function save(rule: AnalysisRuleEntity) {
    const now = dayjs().toISOString()
    const entity = { ...rule, updatedAt: now }
    await AnalysisRuleRepository.save(entity)
    const idx = rules.value.findIndex((r) => r.id === entity.id)
    if (idx >= 0) rules.value[idx] = entity
    else rules.value.push(entity)
  }

  async function remove(id: string) {
    await AnalysisRuleRepository.delete(id)
    rules.value = rules.value.filter((r) => r.id !== id)
  }

  function createDraft(): AnalysisRuleEntity {
    const now = dayjs().toISOString()
    return {
      id: uuid(),
      name: `规则 ${rules.value.length + 1}`,
      enabled: true,
      conditions: [{ field: 'wordCount', operator: 'gt', value: '500' }],
      modelId: '',
      promptTemplateId: '',
      priority: 'normal',
      createdAt: now,
      updatedAt: now,
    }
  }

  return { rules, load, save, remove, createDraft }
})
