<script lang="ts" setup>
import { computed, ref, watch } from 'vue'
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

const faviconFailed = ref(false)

const faviconUrl = computed(() => {
  const doc = documentStore.currentDocument as any
  if (doc?.favicon) return doc.favicon
  if (domain.value) return `https://www.google.com/s2/favicons?domain=${domain.value}&sz=32`
  return null
})

watch(() => documentStore.currentDocument, () => {
  faviconFailed.value = false
})

const statusColorMap: Record<string, string> = {
  idle: 'bg-zinc-300',
  extracting: 'bg-amber-400',
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
      <img
        v-if="faviconUrl && !faviconFailed"
        :src="faviconUrl"
        class="w-5 h-5 rounded"
        @error="faviconFailed = true"
      />
      <svg v-else class="w-4 h-4 text-zinc-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <line x1="2" y1="12" x2="22" y2="12"/>
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
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
