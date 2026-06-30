<script lang="ts" setup>
import { Database, RefreshCw } from '@lucide/vue'

defineProps<{
  docCount: number
}>()

const emit = defineEmits<{
  refresh: []
}>()
</script>

<template>
  <div class="flex items-center gap-2">
    <div class="text-[14px] font-semibold text-zinc-900 flex items-center gap-2">
      <Database class="w-4 h-4 text-brand" />
      记忆库
      <span class="text-[11px] font-normal text-zinc-400">{{ docCount }} 篇</span>
    </div>
    <button
      class="p-1.5 rounded-md text-zinc-500 hover:bg-zinc-100"
      title="刷新记忆库"
      @click="emit('refresh')"
    >
      <RefreshCw class="w-4 h-4" />
    </button>
  </div>
</template>
