<script lang="ts" setup>
import { Plus, Trash2, XCircle } from '@lucide/vue'
import Switch from '@/components/ui/Switch.vue'
import UInput from '@/components/ui/UInput.vue'
import { useWorkflowStore } from '@/stores/workflow.store'
import type { WorkflowEntity } from '@/types/workflow'
import type { SelectOption } from './select-option'

const props = defineProps<{
  modelOptions: SelectOption[]
  templateOptions: SelectOption[]
}>()

const workflowStore = useWorkflowStore()

function addWorkflow() {
  void workflowStore.save(workflowStore.createDraft())
}

async function removeWorkflow(id: string) {
  await workflowStore.remove(id)
}

async function addStep(wfId: string) {
  await workflowStore.addStep(wfId)
}

async function removeStep(wfId: string, stepId: string) {
  await workflowStore.removeStep(wfId, stepId)
}

async function persistWorkflow(wf: WorkflowEntity) {
  await workflowStore.save(wf)
}

function stepIncomplete(wf: WorkflowEntity): boolean {
  return !wf.steps.length || wf.steps.some((step) => !step.modelId)
}
</script>

<template>
  <div class="space-y-3">
    <div class="flex items-center justify-between">
      <div class="text-[11px] text-zinc-500">
        编排多步骤分析流程：上一步完成后自动触发下一步
      </div>
      <button
        class="text-[10px] text-brand hover:text-brand-dark flex items-center gap-0.5 px-2 py-1 rounded hover:bg-brand/5"
        @click="addWorkflow"
      >
        <Plus class="w-3 h-3" /> 新建工作流
      </button>
    </div>

    <div
      v-for="wf in workflowStore.workflows"
      :key="wf.id"
      class="rounded-lg border border-zinc-200 overflow-hidden"
    >
      <div class="px-3 py-2.5 flex items-center justify-between border-b border-zinc-100 bg-zinc-50/50">
        <div class="flex items-center gap-2 flex-1 min-w-0">
          <Switch
            :model-value="wf.enabled"
            @update:model-value="(v: boolean) => { wf.enabled = v; persistWorkflow(wf) }"
          />
          <UInput
            v-model="wf.name"
            class="flex-1 text-[12px] font-medium"
            placeholder="工作流名称"
            @change="persistWorkflow(wf)"
          />
        </div>
        <button
          class="p-1 rounded text-zinc-300 hover:text-red-500 hover:bg-red-50 transition-colors ml-1"
          @click="removeWorkflow(wf.id)"
        >
          <Trash2 class="w-3 h-3" />
        </button>
      </div>

      <div class="px-3 py-2">
        <UInput
          v-model="wf.description"
          class="w-full text-[10px] text-zinc-500"
          placeholder="工作流描述"
          @change="persistWorkflow(wf)"
        />
        <div v-if="stepIncomplete(wf)" class="mt-1 text-[10px] text-amber-600">
          请为每个步骤选择模型后，才能从批量分析中运行此工作流。
        </div>
      </div>

      <div class="px-3 pb-3 space-y-1.5">
        <div
          v-for="(step, idx) in wf.steps"
          :key="step.id"
          class="grid grid-cols-[20px_minmax(72px,0.8fr)_minmax(100px,1fr)_minmax(100px,1fr)_20px] items-center gap-2 min-w-0"
        >
          <div class="w-5 h-5 rounded-full bg-zinc-900 text-white text-[9px] font-bold flex items-center justify-center shrink-0">
            {{ idx + 1 }}
          </div>
          <UInput
            v-model="step.label"
            class="min-w-0 w-full text-[10px]"
            placeholder="步骤名"
            @change="persistWorkflow(wf)"
          />
          <select
            v-model="step.templateId"
            class="min-w-0 w-full text-[10px] bg-white border border-zinc-200 rounded px-1.5 py-1 outline-none focus:border-brand"
            @change="persistWorkflow(wf)"
          >
            <option v-for="opt in props.templateOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
          </select>
          <select
            v-model="step.modelId"
            class="min-w-0 w-full text-[10px] bg-white border border-zinc-200 rounded px-1.5 py-1 outline-none focus:border-brand"
            @change="persistWorkflow(wf)"
          >
            <option v-for="opt in props.modelOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
          </select>
          <button
            class="p-0.5 rounded text-zinc-300 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
            @click="removeStep(wf.id, step.id)"
          >
            <XCircle class="w-3 h-3" />
          </button>
        </div>
        <button
          class="w-full py-1 rounded-md text-[10px] text-zinc-400 hover:text-brand hover:bg-brand/5 border border-dashed border-zinc-200 transition-colors flex items-center justify-center gap-1"
          @click="addStep(wf.id)"
        >
          <Plus class="w-2.5 h-2.5" /> 添加步骤
        </button>
      </div>
    </div>

    <div v-if="!workflowStore.workflows.length" class="text-center py-6 text-[11px] text-zinc-400">
      暂无工作流，点击「新建工作流」开始编排
    </div>
  </div>
</template>
