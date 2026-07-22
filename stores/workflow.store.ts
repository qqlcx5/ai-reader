import dayjs from 'dayjs'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { WorkflowRepository } from '@/db/repositories/workflow.repository'
import type { WorkflowEntity, WorkflowStep } from '@/types/workflow'
import type { AiJobPriority } from '@/types/ai-job'

function uuid(): string {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

export const useWorkflowStore = defineStore('workflow', () => {
  const workflows = ref<WorkflowEntity[]>([])

  async function load() {
    workflows.value = await WorkflowRepository.findAll()
  }

  async function save(workflow: WorkflowEntity) {
    const now = dayjs().toISOString()
    const entity = { ...workflow, updatedAt: now }
    await WorkflowRepository.save(entity)
    const idx = workflows.value.findIndex((w) => w.id === entity.id)
    if (idx >= 0) workflows.value[idx] = entity
    else workflows.value.push(entity)
  }

  async function remove(id: string) {
    await WorkflowRepository.delete(id)
    workflows.value = workflows.value.filter((w) => w.id !== id)
  }

  function createDraft(): WorkflowEntity {
    const now = dayjs().toISOString()
    const draft: WorkflowEntity = {
      id: uuid(),
      name: `工作流 ${workflows.value.length + 1}`,
      description: '',
      enabled: false,
      priority: 'normal',
      steps: [
        { id: uuid(), templateId: '', modelId: '', label: '步骤 1' },
      ],
      createdAt: now,
      updatedAt: now,
    }
    return draft
  }

  async function addStep(workflowId: string) {
    const wf = workflows.value.find((w) => w.id === workflowId)
    if (!wf) return
    const step: WorkflowStep = {
      id: uuid(),
      templateId: '',
      modelId: '',
      label: `步骤 ${wf.steps.length + 1}`,
    }
    wf.steps.push(step)
    await save(wf)
  }

  async function removeStep(workflowId: string, stepId: string) {
    const wf = workflows.value.find((w) => w.id === workflowId)
    if (!wf) return
    wf.steps = wf.steps.filter((s) => s.id !== stepId)
    await save(wf)
  }

  async function setPriority(workflowId: string, priority: AiJobPriority) {
    const wf = workflows.value.find((w) => w.id === workflowId)
    if (!wf) return
    wf.priority = priority
    await save(wf)
  }

  return {
    workflows,
    load,
    save,
    remove,
    createDraft,
    addStep,
    removeStep,
    setPriority,
  }
})
