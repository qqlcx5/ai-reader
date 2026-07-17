<script lang="ts" setup>
import dayjs from 'dayjs'
import { computed, onMounted } from 'vue'
import { Zap, RefreshCw, Trash2, RotateCcw } from '@lucide/vue'
import Switch from '@/components/ui/Switch.vue'
import Select from '@/components/ui/Select.vue'
import UButton from '@/components/ui/UButton.vue'
import { useSettingsStore } from '@/stores/settings.store'
import { useModelStore } from '@/stores/model.store'
import { usePromptTemplateStore } from '@/stores/prompt-template.store'
import { useAiJobStore } from '@/stores/ai-job.store'

const settingsStore = useSettingsStore()
const modelStore = useModelStore()
const promptStore = usePromptTemplateStore()
const aiJobStore = useAiJobStore()

const cfg = computed(() => settingsStore.settings.autoAnalysis)

const modelOptions = computed(() =>
  modelStore.models
    .filter((m) => m.enabled)
    .map((m) => ({ value: m.id, label: m.name })),
)

const templateOptions = computed(() => [
  { value: '__none__', label: '不使用模板（仅系统提示词）' },
  ...promptStore.templates.map((t) => ({ value: t.id, label: t.title })),
])

function setStatus(v: boolean) {
  settingsStore.updateAutoAnalysis({ enabled: v })
}

onMounted(async () => {
  aiJobStore.loadJobs()
  // Drain pending jobs that accrued while the panel was closed / on other views.
  aiJobStore.drain()
})

const statusLabel: Record<string, string> = {
  pending: '等待',
  processing: '处理中',
  success: '成功',
  failed: '失败',
}
const statusClass: Record<string, string> = {
  pending: 'bg-zinc-100 text-zinc-500',
  processing: 'bg-brand/10 text-brand',
  success: 'bg-emerald-100 text-emerald-600',
  failed: 'bg-red-100 text-red-600',
}

function fmtTime(iso?: string) {
  if (!iso) return ''
  try {
    return dayjs(iso).format('YYYY/M/D HH:mm:ss')
  } catch {
    return iso
  }
}
</script>

<template>
  <div class="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden text-[13px]">
    <div class="p-3 border-b border-zinc-100 flex items-center justify-between">
      <span class="text-zinc-700 flex items-center gap-1.5">
        <Zap class="w-3.5 h-3.5 text-zinc-400" />
        自动 AI 分析
      </span>
      <Switch :model-value="cfg.enabled" @update:model-value="setStatus" />
    </div>

    <div class="p-3 space-y-2.5">
      <div class="grid grid-cols-2 gap-2">
        <div>
          <label class="text-[11px] text-zinc-500 font-medium">模型</label>
          <Select
            :model-value="cfg.modelId ?? ''"
            :options="modelOptions"
            class="mt-1"
            @update:model-value="(v: string) => settingsStore.updateAutoAnalysis({ modelId: v })"
          />
        </div>
        <div>
          <label class="text-[11px] text-zinc-500 font-medium">提示词模板</label>
          <Select
            :model-value="cfg.promptTemplateId ?? '__none__'"
            :options="templateOptions"
            placeholder="不选则使用系统提示词"
            class="mt-1"
            @update:model-value="(v: string) => settingsStore.updateAutoAnalysis({ promptTemplateId: v === '__none__' ? undefined : v })"
          />
        </div>
      </div>
      <p class="text-[10px] text-zinc-400 leading-relaxed">
        开启后，自动入库的文章会用所选模型 + 模板自动分析，结果存为该文档的一条会话。
        模板可留空 —— 只用系统提示词也能工作。仅对「自动入库」的订阅源生效。
      </p>
    </div>

    <!-- Queue -->
    <div class="border-t border-zinc-100 p-3">
      <div class="flex items-center justify-between mb-2">
        <span class="text-[11px] text-zinc-400 font-medium">处理队列</span>
        <div class="flex items-center gap-1">
          <button
            class="p-1 rounded text-zinc-400 hover:text-brand hover:bg-zinc-100 transition-colors disabled:opacity-40"
            :disabled="aiJobStore.draining"
            title="立即处理"
            @click="aiJobStore.drain()"
          >
            <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': aiJobStore.draining }" />
          </button>
          <button
            class="p-1 rounded text-zinc-400 hover:text-red-500 hover:bg-zinc-100 transition-colors"
            title="清空已完成/失败"
            @click="aiJobStore.clearDone()"
          >
            <Trash2 class="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div v-if="aiJobStore.jobs.length" class="space-y-1.5 max-h-56 overflow-y-auto no-scrollbar">
        <div
          v-for="job in aiJobStore.jobs"
          :key="job.id"
          class="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-zinc-50 group"
        >
          <span class="truncate flex-1 text-[12px] text-zinc-700">{{ job.documentTitle || job.documentId }}</span>
          <span
            class="text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0"
            :class="statusClass[job.status]"
          >{{ statusLabel[job.status] }}</span>
          <button
            v-if="job.status === 'failed'"
            class="p-0.5 rounded text-zinc-400 hover:text-brand shrink-0"
            title="重试"
            @click="aiJobStore.retry(job.id)"
          >
            <RotateCcw class="w-3 h-3" />
          </button>
          <span class="text-[10px] text-zinc-300 shrink-0">{{ fmtTime(job.finishedAt || job.createdAt) }}</span>
        </div>
        <p v-if="aiJobStore.jobs.find((j) => j.status === 'failed' && j.error)" class="text-[10px] text-red-400 px-2">
          {{ aiJobStore.jobs.find((j) => j.status === 'failed' && j.error)?.error }}
        </p>
      </div>
      <div v-else class="text-center text-[11px] text-zinc-400 py-4">队列为空</div>
    </div>
  </div>
</template>
