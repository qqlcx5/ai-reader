<script lang="ts" setup>
import {
  Zap, Play, Pause, RefreshCw, CheckSquare, Plus,
} from '@lucide/vue'
import { useAiJobStore } from '@/stores/ai-job.store'
import { useAppStore } from '@/stores/app.store'

const emit = defineEmits<{
  'new-analysis': []
  'toggle-select-mode': []
}>()

const props = defineProps<{
  selectMode: boolean
}>()

const aiJobStore = useAiJobStore()
const appStore = useAppStore()

async function handleTogglePause() {
  await aiJobStore.toggleQueuePause()
  appStore.showToast(
    aiJobStore.queuePaused ? '队列已暂停' : '队列已恢复',
    'info',
  )
  if (!aiJobStore.queuePaused && aiJobStore.stats.pending > 0) {
    void aiJobStore.drain()
  }
}

async function handleRetryAllFailed() {
  const count = aiJobStore.jobs.filter((j) => j.status === 'failed' || j.status === 'cancelled').length
  if (!count) return
  await aiJobStore.retryAllFailed()
  appStore.showToast(`已重新入队 ${count} 个失败或取消任务`, 'success')
}

async function handleDrain() {
  await aiJobStore.drain()
}
</script>

<template>
  <div class="h-12 shrink-0 px-4 flex items-center justify-between border-b border-zinc-200/70 bg-surface/90 backdrop-blur-md">
    <div class="text-[14px] font-semibold flex items-center gap-2">
      <Zap class="w-4 h-4 text-brand" />
      AI 分析
      <span v-if="aiJobStore.stats.total > 0" class="text-[11px] font-normal text-zinc-400">
        {{ aiJobStore.stats.total }} 个任务
      </span>
      <span v-if="aiJobStore.queuePaused" class="px-1.5 py-0.5 rounded text-[9px] font-medium bg-amber-100 text-amber-600 flex items-center gap-0.5">
        <Pause class="w-2.5 h-2.5" /> 队列已暂停
      </span>
    </div>
    <div class="flex items-center gap-1.5">
      <button
        class="px-2.5 py-1 rounded-md text-[11px] font-medium text-white bg-brand hover:bg-brand-dark transition-colors flex items-center gap-1"
        @click="emit('new-analysis')"
      >
        <Plus class="w-3 h-3" />
        新建分析
      </button>
      <button
        class="px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors flex items-center gap-1"
        :class="props.selectMode
          ? 'bg-brand text-white'
          : 'text-zinc-500 bg-white border border-zinc-200 hover:bg-zinc-50'"
        @click="emit('toggle-select-mode')"
      >
        <CheckSquare class="w-3 h-3" />
        {{ props.selectMode ? '退出多选' : '多选' }}
      </button>
      <button
        v-if="aiJobStore.stats.pending > 0 || aiJobStore.queuePaused"
        class="px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors flex items-center gap-1"
        :class="aiJobStore.queuePaused
          ? 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100'
          : 'text-amber-600 bg-amber-50 hover:bg-amber-100'"
        @click="handleTogglePause"
      >
        <component :is="aiJobStore.queuePaused ? Play : Pause" class="w-3 h-3" />
        {{ aiJobStore.queuePaused ? '恢复队列' : '暂停队列' }}
      </button>
      <button
        v-if="aiJobStore.stats.failed > 0 || aiJobStore.stats.cancelled > 0"
        class="px-2.5 py-1 rounded-md text-[11px] font-medium text-red-500 bg-red-50 hover:bg-red-100 transition-colors flex items-center gap-1"
        @click="handleRetryAllFailed"
      >
        <RefreshCw class="w-3 h-3" /> 重试失败/取消
      </button>
      <button
        v-if="!aiJobStore.queuePaused"
        class="px-2.5 py-1 rounded-md text-[11px] font-medium text-zinc-500 bg-white border border-zinc-200 hover:bg-zinc-50 transition-colors flex items-center gap-1"
        :class="{ 'opacity-50 pointer-events-none': aiJobStore.stats.pending === 0 || aiJobStore.draining }"
        @click="handleDrain"
      >
        <Play class="w-3 h-3" />
        {{ aiJobStore.draining ? '处理中…' : '开始处理' }}
      </button>
    </div>
  </div>
</template>
