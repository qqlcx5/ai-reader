<script lang="ts" setup>
import { computed } from 'vue'
import { useWorkspaceStore } from '@/stores/workspace.store'
import { useDocumentStore } from '@/stores/document.store'

const workspaceStore = useWorkspaceStore()
const documentStore = useDocumentStore()

const domain = computed(() => {
  const url = documentStore.currentDocument?.url
  if (!url) return ''
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
})

const tokenCount = computed(() => {
  return documentStore.currentDocument?.tokenCount ?? 0
})

const statusColorMap: Record<string, string> = {
  idle: 'bg-zinc-300',
  extracting: 'bg-blue-400',
  ready: 'bg-emerald-400',
  cached: 'bg-cyan-400',
  failed: 'bg-red-400',
  stale: 'bg-amber-400',
}

const statusColor = computed(() => {
  return statusColorMap[workspaceStore.captureStatus] || statusColorMap.idle
})
</script>

<template>
  <div class="flex items-center gap-2 min-w-0">
    <div class="w-8 h-8 rounded-lg bg-zinc-100 border border-zinc-200 flex items-center justify-center shrink-0">
      <svg class="w-4 h-4 text-zinc-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
        <polyline points="14 2 14 8 20 8"/>
      </svg>
    </div>
    <div class="min-w-0">
      <div class="text-[13px] font-medium truncate max-w-[145px]">
        {{ documentStore.currentDocument?.title || '未选择文档' }}
      </div>
      <div class="text-[10px] text-zinc-400 flex items-center gap-1">
        <span class="w-1.5 h-1.5 rounded-full" :class="statusColor" />
        <template v-if="domain">{{ domain }}</template>
        <template v-else>—</template>
        <span v-if="tokenCount > 0">· {{ tokenCount.toLocaleString() }} tokens</span>
      </div>
    </div>
  </div>
</template>
