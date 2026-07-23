<script lang="ts" setup>
import { computed, ref } from 'vue'
import {
  Zap, Clock, Loader2, Activity, Timer, CheckCircle2, XCircle, Pause,
  ArrowDown,
} from '@lucide/vue'
import AnalysisJobRow from './AnalysisJobRow.vue'
import { useAiJobStore } from '@/stores/ai-job.store'
import { useAppStore } from '@/stores/app.store'
import { useModelStore } from '@/stores/model.store'
import { formatMs } from '@/utils/cost'
import type { AiJobEntity, AiJobPriority, AiJobStatus } from '@/types/ai-job'
import type { ModelConfig } from '@/types/model'

const props = defineProps<{
  jobs: AiJobEntity[]
  selectMode: boolean
  selectedIds: Set<string>
  hasActiveFilters: boolean
  filterStatus?: AiJobStatus | 'all'
}>()

const emit = defineEmits<{
  toggle: [jobId: string]
  'select-all': []
  'select-none': []
}>()

const aiJobStore = useAiJobStore()
const appStore = useAppStore()
const modelStore = useModelStore()

const expandedJobId = ref<string | null>(null)
const dragJobId = ref<string | null>(null)
const dragOverJobId = ref<string | null>(null)

const modelMap = computed(() => {
  const map = new Map<string, ModelConfig>()
  for (const m of modelStore.models) map.set(m.id, m)
  return map
})

function modelName(id: string): string {
  return modelMap.value.get(id)?.name ?? id
}

function priorityLabel(p?: AiJobPriority): string {
  return p === 'high' ? '高' : p === 'low' ? '低' : '中'
}

const progressPercent = computed(() => {
  const { total, pending, processing } = aiJobStore.stats
  if (total === 0) return 0
  const done = total - pending - processing
  return Math.round((done / total) * 100)
})

const activeCount = computed(() => aiJobStore.stats.pending + aiJobStore.stats.processing)

const showDragDropList = computed(() => {
  const st = props.filterStatus
  return (!st || st === 'all' || st === 'pending') && aiJobStore.sortedPendingJobs.length > 1
})

function toggleExpand(job: AiJobEntity) {
  expandedJobId.value = expandedJobId.value === job.id ? null : job.id
}

function onDragStart(jobId: string, e: DragEvent) {
  dragJobId.value = jobId
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', jobId)
  }
}

function onDragOver(jobId: string, e: DragEvent) {
  if (!dragJobId.value || dragJobId.value === jobId) return
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
  dragOverJobId.value = jobId
}

function onDragLeave() {
  dragOverJobId.value = null
}

async function onDrop(jobId: string, e: DragEvent) {
  e.preventDefault()
  e.stopPropagation()
  const draggedId = dragJobId.value
  dragOverJobId.value = null
  dragJobId.value = null
  if (!draggedId || draggedId === jobId) return

  const pending = aiJobStore.sortedPendingJobs.map((j) => j.id)
  const fromIdx = pending.indexOf(draggedId)
  const toIdx = pending.indexOf(jobId)
  if (fromIdx < 0 || toIdx < 0) return
  pending.splice(fromIdx, 1)
  pending.splice(toIdx, 0, draggedId)
  await aiJobStore.reorderPendingJobs(pending)
}

async function handleClearByStatus(status: AiJobStatus) {
  await aiJobStore.clearByStatus(status)
  appStore.showToast('已清除', 'info')
}
</script>

<template>
  <!-- Stats (same order as before: after config, before filters) -->
  <div class="grid grid-cols-4 gap-2.5">
    <div class="bg-white rounded-xl border border-zinc-200 shadow-sm p-3">
      <div class="flex items-center gap-1 text-[10px] text-zinc-400">
        <Activity class="w-3 h-3" /> 总任务
      </div>
      <div class="text-[18px] font-semibold text-zinc-900 mt-0.5">{{ aiJobStore.stats.total }}</div>
    </div>
    <div class="bg-white rounded-xl border border-zinc-200 shadow-sm p-3">
      <div class="flex items-center gap-1 text-[10px] text-zinc-400">
        <CheckCircle2 class="w-3 h-3 text-emerald-500" /> 成功
      </div>
      <div class="text-[18px] font-semibold text-emerald-600 mt-0.5">{{ aiJobStore.stats.success }}</div>
    </div>
    <div class="bg-white rounded-xl border border-zinc-200 shadow-sm p-3">
      <div class="flex items-center gap-1 text-[10px] text-zinc-400">
        <XCircle class="w-3 h-3 text-red-500" /> 失败
      </div>
      <div class="text-[18px] font-semibold text-red-500 mt-0.5">{{ aiJobStore.stats.failed }}</div>
    </div>
    <div class="bg-white rounded-xl border border-zinc-200 shadow-sm p-3">
      <div class="flex items-center gap-1 text-[10px] text-zinc-400">
        <Timer class="w-3 h-3" /> 平均耗时
      </div>
      <div class="text-[18px] font-semibold text-zinc-900 mt-0.5">{{ formatMs(aiJobStore.stats.avgDurationMs) }}</div>
    </div>
  </div>

  <!-- Progress -->
  <div v-if="activeCount > 0" class="bg-white rounded-xl border border-zinc-200 shadow-sm p-3.5">
    <div class="flex items-center justify-between text-[12px] mb-2">
      <span class="font-medium text-zinc-700 flex items-center gap-1.5">
        处理进度
        <span v-if="aiJobStore.queuePaused" class="text-[10px] text-amber-500 flex items-center gap-0.5">
          <Pause class="w-2.5 h-2.5" /> 已暂停
        </span>
      </span>
      <span class="text-zinc-400 tabular-nums">
        {{ aiJobStore.stats.total - activeCount }} / {{ aiJobStore.stats.total }}（{{ progressPercent }}%）
      </span>
    </div>
    <div class="h-2 bg-zinc-100 rounded-full overflow-hidden">
      <div
        class="h-full rounded-full transition-all duration-500"
        :class="aiJobStore.queuePaused ? 'bg-amber-400' : 'bg-brand'"
        :style="{ width: `${progressPercent}%` }"
      />
    </div>
    <div class="flex items-center gap-3 mt-2 text-[10px] text-zinc-400">
      <span class="flex items-center gap-0.5">
        <Clock class="w-2.5 h-2.5 text-amber-500" /> 等待 {{ aiJobStore.stats.pending }}
      </span>
      <span class="flex items-center gap-0.5">
        <Loader2 class="w-2.5 h-2.5 text-blue-500 animate-spin" /> 处理 {{ aiJobStore.stats.processing }}
      </span>
    </div>
  </div>

  <!-- Pending drag-and-drop -->
  <div v-if="showDragDropList && !aiJobStore.queuePaused" class="bg-white rounded-xl border border-zinc-200 shadow-sm p-3">
    <div class="text-[11px] text-zinc-400 mb-2 flex items-center gap-1">
      <ArrowDown class="w-3 h-3" /> 拖拽调整等待中任务的执行顺序
    </div>
    <div class="flex flex-col gap-1">
      <div
        v-for="(job, idx) in aiJobStore.sortedPendingJobs"
        :key="job.id"
        draggable="true"
        class="flex items-center gap-2 px-2 py-1.5 rounded-md cursor-grab active:cursor-grabbing transition-colors"
        :class="dragOverJobId === job.id ? 'bg-brand/10 border border-brand/30' : 'hover:bg-zinc-50 border border-transparent'"
        @dragstart="onDragStart(job.id, $event)"
        @dragover="onDragOver(job.id, $event)"
        @dragleave="onDragLeave"
        @drop="onDrop(job.id, $event)"
        @dragend="dragJobId = null; dragOverJobId = null"
      >
        <span class="text-[10px] text-zinc-300 tabular-nums w-4">{{ idx + 1 }}</span>
        <Clock class="w-3 h-3 text-amber-500 shrink-0" />
        <span class="text-[12px] text-zinc-700 truncate flex-1">{{ job.documentTitle || job.documentId }}</span>
        <span class="text-[10px] text-zinc-400">{{ modelName(job.modelId) }}</span>
        <span v-if="job.priority && job.priority !== 'normal'" class="text-[9px] px-1 rounded" :class="job.priority === 'high' ? 'bg-red-50 text-red-500' : 'bg-zinc-100 text-zinc-400'">
          {{ priorityLabel(job.priority) }}
        </span>
      </div>
    </div>
  </div>

  <!-- Filters slot (keeps original visual order: after stats/progress/drag) -->
  <slot name="filters" />

  <!-- Select-all bar -->
  <div v-if="props.selectMode" class="flex items-center gap-2 text-[11px] text-zinc-400">
    <button class="hover:text-zinc-600 transition-colors" @click="emit('select-all')">
      全选 {{ props.jobs.length }}
    </button>
    <span>·</span>
    <button class="hover:text-zinc-600 transition-colors" @click="emit('select-none')">
      取消全选
    </button>
  </div>

  <!-- Empty -->
  <div v-if="props.jobs.length === 0" class="text-center py-16">
    <Zap class="w-8 h-8 text-zinc-300 mx-auto mb-2" />
    <div class="text-[13px] text-zinc-400">
      {{ props.hasActiveFilters ? '没有匹配的任务' : '暂无分析任务' }}
    </div>
    <div v-if="!props.hasActiveFilters" class="text-[11px] text-zinc-400 mt-1">
      在记忆库中多选文档后点击「批量分析」即可创建
    </div>
  </div>

  <!-- Rows -->
  <div v-else class="flex flex-col gap-1.5">
    <AnalysisJobRow
      v-for="job in props.jobs"
      :key="job.id"
      :job="job"
      :select-mode="props.selectMode"
      :selected="props.selectedIds.has(job.id)"
      :expanded="expandedJobId === job.id"
      @toggle="emit('toggle', job.id)"
      @expand="toggleExpand(job)"
    />

    <div v-if="aiJobStore.stats.success > 0 || aiJobStore.stats.failed > 0 || aiJobStore.stats.cancelled > 0" class="flex items-center justify-center gap-2 pt-3 pb-2">
      <button
        v-if="aiJobStore.stats.success > 0"
        class="px-2.5 py-1 rounded-md text-[11px] text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-colors"
        @click="handleClearByStatus('success')"
      >
        清除成功 ({{ aiJobStore.stats.success }})
      </button>
      <button
        v-if="aiJobStore.stats.failed > 0"
        class="px-2.5 py-1 rounded-md text-[11px] text-zinc-400 hover:text-red-500 hover:bg-red-50 transition-colors"
        @click="handleClearByStatus('failed')"
      >
        清除失败 ({{ aiJobStore.stats.failed }})
      </button>
      <button
        v-if="aiJobStore.stats.cancelled > 0"
        class="px-2.5 py-1 rounded-md text-[11px] text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-colors"
        @click="handleClearByStatus('cancelled')"
      >
        清除已取消 ({{ aiJobStore.stats.cancelled }})
      </button>
    </div>
  </div>
</template>
