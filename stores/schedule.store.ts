import dayjs from 'dayjs'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { ScheduleRepository } from '@/db/repositories/schedule.repository'
import type { ScheduleEntity } from '@/types/schedule'
import type { AiJobPriority } from '@/types/ai-job'

function uuid(): string {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

export const useScheduleStore = defineStore('schedule', () => {
  const schedules = ref<ScheduleEntity[]>([])

  async function load() {
    schedules.value = await ScheduleRepository.findAll()
  }

  async function save(schedule: ScheduleEntity) {
    const now = dayjs().toISOString()
    const entity = { ...schedule, updatedAt: now }
    await ScheduleRepository.save(entity)
    const idx = schedules.value.findIndex((s) => s.id === entity.id)
    if (idx >= 0) schedules.value[idx] = entity
    else schedules.value.push(entity)
  }

  async function remove(id: string) {
    await ScheduleRepository.delete(id)
    schedules.value = schedules.value.filter((s) => s.id !== id)
  }

  function createDraft(): ScheduleEntity {
    const now = dayjs().toISOString()
    return {
      id: uuid(),
      enabled: false,
      label: '新定时计划',
      cron: '0 9 * * 1-5',
      scope: 'all',
      modelId: '',
      promptTemplateId: '',
      priority: 'normal' as AiJobPriority,
      createdAt: now,
      updatedAt: now,
    }
  }

  return { schedules, load, save, remove, createDraft }
})
