<script lang="ts" setup>
import { computed, ref } from 'vue'
import {
  Clock, Loader2, CheckCircle2, XCircle, Ban, Filter, X,
} from '@lucide/vue'
import { useAiJobStore } from '@/stores/ai-job.store'
import { useModelStore } from '@/stores/model.store'
import type { AiJobFilter, AiJobStatus } from '@/types/ai-job'

const props = defineProps<{
  filter: AiJobFilter
  hasActiveFilters: boolean
}>()

const emit = defineEmits<{
  'set-filter': [patch: Partial<AiJobFilter>]
  'reset-filter': []
}>()

const aiJobStore = useAiJobStore()
const modelStore = useModelStore()
const showFilter = ref(false)

const statusOptions: { value: AiJobStatus | 'all'; label: string; icon: any; color: string }[] = [
  { value: 'all', label: '全部', icon: null, color: '' },
  { value: 'pending', label: '等待中', icon: Clock, color: 'text-amber-500' },
  { value: 'processing', label: '处理中', icon: Loader2, color: 'text-blue-500' },
  { value: 'success', label: '成功', icon: CheckCircle2, color: 'text-emerald-500' },
  { value: 'failed', label: '失败', icon: XCircle, color: 'text-red-500' },
  { value: 'cancelled', label: '已取消', icon: Ban, color: 'text-zinc-400' },
]

const modelFilterOptions = computed(() => [
  { value: '', label: '全部模型' },
  ...modelStore.models.map((m) => ({ value: m.id, label: m.name })),
])

function statusCount(value: AiJobStatus | 'all'): number {
  if (value === 'pending') return aiJobStore.stats.pending
  if (value === 'processing') return aiJobStore.stats.processing
  if (value === 'success') return aiJobStore.stats.success
  if (value === 'cancelled') return aiJobStore.stats.cancelled
  if (value === 'failed') return aiJobStore.stats.failed
  return 0
}
</script>

<template>
  <div class="flex items-center gap-1.5 flex-wrap">
    <button
      v-for="opt in statusOptions"
      :key="opt.value"
      class="px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors flex items-center gap-1"
      :class="(props.filter.status || 'all') === opt.value
        ? 'bg-zinc-900 text-white'
        : 'bg-white text-zinc-500 border border-zinc-200 hover:bg-zinc-50'"
      @click="emit('set-filter', { status: opt.value })"
    >
      <component v-if="opt.icon" :is="opt.icon" class="w-3 h-3" :class="opt.color" />
      {{ opt.label }}
      <span v-if="opt.value !== 'all'" class="tabular-nums opacity-60">
        {{ statusCount(opt.value) }}
      </span>
    </button>

    <div class="ml-auto flex items-center gap-1.5">
      <select
        v-if="showFilter"
        :value="props.filter.modelId || ''"
        class="px-2 py-1 rounded-md text-[11px] bg-white border border-zinc-200 text-zinc-600 outline-none"
        @change="(e: Event) => emit('set-filter', { modelId: (e.target as HTMLSelectElement).value || undefined })"
      >
        <option v-for="opt in modelFilterOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
      </select>

      <button
        class="p-1 rounded-md text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-colors"
        :class="{ 'text-brand bg-brand/10': showFilter }"
        @click="showFilter = !showFilter"
      >
        <Filter class="w-3.5 h-3.5" />
      </button>

      <button
        v-if="props.hasActiveFilters"
        class="p-1 rounded-md text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-colors"
        @click="emit('reset-filter')"
      >
        <X class="w-3.5 h-3.5" />
      </button>
    </div>
  </div>
</template>
