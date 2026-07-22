<script lang="ts" setup>
import { Pause, Play, Loader2, RefreshCw } from '@lucide/vue'
import Switch from '@/components/ui/Switch.vue'
import { useAiJobStore } from '@/stores/ai-job.store'

const aiJobStore = useAiJobStore()
</script>

<template>
  <div class="flex flex-wrap items-center gap-2 px-3 py-2 rounded-lg bg-zinc-50 border border-zinc-200">
    <div class="flex items-center gap-1.5">
      <div class="w-1.5 h-1.5 rounded-full" :class="aiJobStore.queuePaused ? 'bg-amber-400' : aiJobStore.stats.pending > 0 ? 'bg-blue-400 animate-pulse' : 'bg-emerald-400'" />
      <span class="text-[10px] text-zinc-500 font-medium">队列</span>
    </div>
    <div class="flex items-center gap-1.5 text-[10px] tabular-nums">
      <span class="text-zinc-400">待处理</span>
      <span class="font-semibold text-zinc-700">{{ aiJobStore.stats.pending }}</span>
      <span class="text-zinc-300">·</span>
      <span class="text-zinc-400">处理中</span>
      <span class="font-semibold text-blue-500">{{ aiJobStore.stats.processing }}</span>
      <span class="text-zinc-300">·</span>
      <span class="text-zinc-400">成功</span>
      <span class="font-semibold text-emerald-500">{{ aiJobStore.stats.success }}</span>
      <span class="text-zinc-300">·</span>
      <span class="text-zinc-400">失败</span>
      <span class="font-semibold text-red-500">{{ aiJobStore.stats.failed }}</span>
    </div>
    <div class="flex-1" />
    <button
      v-if="aiJobStore.stats.pending > 0 && !aiJobStore.draining"
      class="px-2 py-0.5 rounded text-[9px] font-medium text-white bg-blue-500 hover:bg-blue-600 transition-colors flex items-center gap-0.5"
      @click="aiJobStore.drain()"
    >
      <Play class="w-2.5 h-2.5" /> 开始
    </button>
    <Loader2 v-if="aiJobStore.draining" class="w-3 h-3 animate-spin text-blue-500" />
    <button
      v-if="aiJobStore.stats.failed > 0 || aiJobStore.stats.cancelled > 0"
      class="px-2 py-0.5 rounded text-[9px] font-medium text-red-500 bg-red-50 hover:bg-red-100 transition-colors flex items-center gap-0.5"
      @click="aiJobStore.retryAllFailed()"
    >
      <RefreshCw class="w-2.5 h-2.5" /> 重试失败/取消
    </button>
    <div class="flex items-center gap-1.5 pl-1 border-l border-zinc-200">
      <Pause class="w-3 h-3 text-amber-500" />
      <span class="text-[10px] text-zinc-500">暂停</span>
      <Switch
        :model-value="aiJobStore.queuePaused"
        @update:model-value="() => aiJobStore.toggleQueuePause()"
      />
    </div>
  </div>
</template>
