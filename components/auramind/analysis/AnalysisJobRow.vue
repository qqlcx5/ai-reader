<script lang="ts" setup>
import { computed } from 'vue'
import dayjs from 'dayjs'
import {
  Clock, Loader2, CheckCircle2, XCircle, ChevronDown, ChevronRight,
  CheckSquare, Square, MoreVertical,
} from '@lucide/vue'
import UDropdownMenu from '@/components/ui/UDropdownMenu.vue'
import AnalysisJobDetail from './AnalysisJobDetail.vue'
import { useAiJobStore } from '@/stores/ai-job.store'
import { useModelStore } from '@/stores/model.store'
import { usePromptTemplateStore } from '@/stores/prompt-template.store'
import { formatMs } from '@/utils/cost'
import type { AiJobEntity, AiJobPriority, AiJobStatus } from '@/types/ai-job'
import type { ModelConfig } from '@/types/model'

const props = defineProps<{
  job: AiJobEntity
  selectMode: boolean
  selected: boolean
  expanded: boolean
}>()

const emit = defineEmits<{
  toggle: []
  expand: []
}>()

const aiJobStore = useAiJobStore()
const modelStore = useModelStore()
const promptStore = usePromptTemplateStore()

const modelMap = computed(() => {
  const map = new Map<string, ModelConfig>()
  for (const m of modelStore.models) map.set(m.id, m)
  return map
})

function modelName(id: string): string {
  return modelMap.value.get(id)?.name ?? id
}

function templateName(id: string): string {
  if (!id) return '无模板'
  return promptStore.templates.find((t) => t.id === id)?.title ?? id
}

function formatTime(iso: string): string {
  const date = dayjs(iso)
  if (!date.isValid()) return iso
  const minutes = dayjs().diff(date, 'minute')
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes} 分钟前`
  return date.format('MM-DD HH:mm')
}

function jobDuration(job: AiJobEntity): string {
  if (!job.finishedAt || !job.createdAt) return '—'
  const ms = dayjs(job.finishedAt).valueOf() - dayjs(job.createdAt).valueOf()
  if (ms <= 0) return '—'
  return formatMs(ms)
}

function priorityLabel(p?: AiJobPriority): string {
  return p === 'high' ? '高' : p === 'low' ? '低' : '中'
}

function priorityColor(p?: AiJobPriority): string {
  return p === 'high' ? 'text-red-500' : p === 'low' ? 'text-zinc-400' : 'text-zinc-500'
}

const statusConfig: Record<AiJobStatus, { color: string; bg: string; icon: any; label: string }> = {
  pending: { color: 'text-amber-600', bg: 'bg-amber-50', icon: Clock, label: '等待中' },
  processing: { color: 'text-blue-600', bg: 'bg-blue-50', icon: Loader2, label: '处理中' },
  success: { color: 'text-emerald-600', bg: 'bg-emerald-50', icon: CheckCircle2, label: '成功' },
  failed: { color: 'text-red-600', bg: 'bg-red-50', icon: XCircle, label: '失败' },
  cancelled: { color: 'text-zinc-500', bg: 'bg-zinc-100', icon: XCircle, label: '已取消' },
}

async function handleSetPriority(priority: AiJobPriority) {
  await aiJobStore.setPriority(props.job.id, priority)
}
</script>

<template>
  <div
    class="bg-white rounded-xl border shadow-sm overflow-hidden transition-colors"
    :class="props.selected ? 'border-brand ring-1 ring-brand/20' : 'border-zinc-200'"
  >
    <div class="flex items-center gap-3 px-3.5 py-2.5">
      <button
        v-if="props.selectMode"
        class="shrink-0 p-0.5"
        @click.stop="emit('toggle')"
      >
        <component
          :is="props.selected ? CheckSquare : Square"
          class="w-4 h-4 transition-colors"
          :class="props.selected ? 'text-brand' : 'text-zinc-300'"
        />
      </button>

      <div
        class="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
        @click="props.selectMode ? emit('toggle') : emit('expand')"
      >
        <div class="shrink-0">
          <component
            :is="statusConfig[job.status].icon"
            class="w-4 h-4"
            :class="[statusConfig[job.status].color, job.status === 'processing' ? 'animate-spin' : '']"
          />
        </div>

        <div class="min-w-0 flex-1">
          <div class="text-[13px] font-medium text-zinc-900 truncate">
            {{ job.documentTitle || job.documentId }}
          </div>
          <div class="text-[10px] text-zinc-400 mt-0.5 flex items-center gap-2">
            <span>{{ modelName(job.modelId) }}</span>
            <span>·</span>
            <span>{{ templateName(job.promptTemplateId) }}</span>
            <span>·</span>
            <span>{{ formatTime(job.createdAt) }}</span>
            <span v-if="job.batchId" class="text-brand/60">· 批次</span>
            <span v-if="job.priority && job.priority !== 'normal'" class="font-medium" :class="priorityColor(job.priority)">
              · {{ priorityLabel(job.priority) }}优先
            </span>
          </div>
        </div>

        <div class="shrink-0 text-right">
          <div v-if="job.status === 'success'" class="text-[11px] text-zinc-400 tabular-nums">{{ jobDuration(job) }}</div>
          <div v-else-if="job.status === 'failed'" class="text-[11px] text-red-400 truncate max-w-[120px]">{{ job.error }}</div>
          <div v-else class="text-[11px] text-zinc-400">—</div>
        </div>

        <UDropdownMenu
          v-if="job.status === 'pending'"
          :items="[
            { key: 'high', label: `高优先级${job.priority === 'high' ? ' ✓' : ''}` },
            { key: 'normal', label: `中优先级${job.priority === 'normal' || !job.priority ? ' ✓' : ''}` },
            { key: 'low', label: `低优先级${job.priority === 'low' ? ' ✓' : ''}` },
          ]"
          content-class="min-w-[100px]"
          @select="(item) => handleSetPriority(item.key as AiJobPriority)"
        >
          <template #trigger>
            <button class="p-1 rounded-md text-zinc-300 hover:text-zinc-500 hover:bg-zinc-100 transition-colors shrink-0">
              <MoreVertical class="w-3.5 h-3.5" />
            </button>
          </template>
        </UDropdownMenu>

        <ChevronRight
          v-if="!props.selectMode && !props.expanded"
          class="w-3.5 h-3.5 text-zinc-300 shrink-0"
        />
        <ChevronDown
          v-if="!props.selectMode && props.expanded"
          class="w-3.5 h-3.5 text-zinc-400 shrink-0"
        />
      </div>
    </div>

    <AnalysisJobDetail
      v-if="props.expanded && !props.selectMode"
      :job="job"
    />
  </div>
</template>
