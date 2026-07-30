<script lang="ts" setup>
import { computed } from 'vue'
import { formatRelative } from '@/utils/date'
import { MessageSquare, Trash2, Globe, ExternalLink, FolderPlus, Check, Zap, AlertCircle, Loader2 } from '@lucide/vue'
import type { DocumentEntity } from '@/types/document'
import { getReadStatus } from '@/types/document'

export type AnalysisStatus = 'success' | 'failed' | 'pending' | 'none'

const props = defineProps<{
  document: DocumentEntity
  hasConversation?: boolean
  analysisStatus?: AnalysisStatus
  selectionMode?: boolean
  selected?: boolean
}>()

const emit = defineEmits<{
  select: [doc: DocumentEntity]
  chat: [doc: DocumentEntity]
  delete: [doc: DocumentEntity]
  openUrl: [doc: DocumentEntity]
  addToCollection: [doc: DocumentEntity]
  toggleSelect: [doc: DocumentEntity]
}>()

const unread = computed(() => readStatus.value === 'unread')
const readStatus = computed(() => getReadStatus(props.document))
const progressPct = computed(() => {
  const p = props.document.readProgress
  if (p == null) return 0
  return Math.round(p * 100)
})

const domain = computed(() => {
  if (props.document.siteName) return props.document.siteName
  try {
    return new URL(props.document.url).hostname
  } catch {
    return props.document.url
  }
})

const favicon = computed(() => {
  try {
    const url = new URL(props.document.url)
    return `https://www.google.com/s2/favicons?domain=${url.hostname}&sz=32`
  } catch {
    return ''
  }
})

const displayTime = computed(() => formatRelative(props.document.capturedAt).replace(/(分钟|小时|天)前$/, ' $1前'))

const excerpt = computed(() => {
  const text = props.document.excerpt || props.document.markdown || ''
  return text.replace(/[#*_`~>\[\]()!|-]/g, '').slice(0, 150)
})
</script>

<template>
  <article
    class="group relative p-2.5 rounded-xl hover:bg-white border border-transparent hover:border-zinc-200 hover:shadow-sm cursor-pointer transition-all flex gap-3"
    :class="{ 'bg-white border-brand/20 shadow-sm': selected && selectionMode }"
    @click="selectionMode ? emit('toggleSelect', document) : emit('select', document)"
  >
    <!-- Selection checkbox -->
    <div
      v-if="selectionMode"
      class="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors"
      :class="selected ? 'bg-brand border-brand text-white' : 'border-zinc-300 text-transparent'"
    >
      <Check v-if="selected" class="w-3 h-3" />
    </div>

    <div class="w-7 h-7 rounded-lg border border-zinc-200 flex items-center justify-center shrink-0 bg-zinc-50 overflow-hidden">
      <img
        v-if="favicon"
        :src="favicon"
        class="w-4 h-4"
        alt=""
        @error="(e) => { (e.target as HTMLImageElement).style.display = 'none' }"
      />
      <Globe v-else class="w-3.5 h-3.5 text-zinc-400" />
    </div>

    <div class="flex-1 min-w-0">
      <div class="text-[13px] font-medium truncate group-hover:text-brand flex items-center gap-1.5">
        <span
          v-if="readStatus === 'unread'"
          class="w-1.5 h-1.5 rounded-full bg-brand shrink-0"
          title="未读"
        />
        <span
          v-else-if="readStatus === 'reading'"
          class="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0"
          title="阅读中"
        />
        <Check
          v-else
          class="w-3 h-3 text-zinc-400 shrink-0"
          title="已读"
        />
        <span class="truncate">{{ document.title }}</span>
      </div>
      <div class="text-[11px] text-zinc-500 flex items-center gap-1.5 truncate mt-1">
        <span class="truncate">{{ domain }}</span>
        <span class="w-[3px] h-[3px] rounded-full bg-zinc-300 shrink-0" />
        <span class="shrink-0">{{ displayTime }}</span>
        <template v-if="hasConversation">
          <span class="w-[3px] h-[3px] rounded-full bg-zinc-300 shrink-0" />
          <span class="inline-flex items-center gap-0.5 text-brand shrink-0">
            <MessageSquare class="w-3 h-3" />已对话
          </span>
        </template>
        <template v-if="analysisStatus === 'success'">
          <span class="w-[3px] h-[3px] rounded-full bg-zinc-300 shrink-0" />
          <span class="inline-flex items-center gap-0.5 text-emerald-600 shrink-0" title="AI 分析完成">
            <Zap class="w-3 h-3" />已分析
          </span>
        </template>
        <template v-else-if="analysisStatus === 'failed'">
          <span class="w-[3px] h-[3px] rounded-full bg-zinc-300 shrink-0" />
          <span class="inline-flex items-center gap-0.5 text-red-500 shrink-0" title="AI 分析失败">
            <AlertCircle class="w-3 h-3" />分析失败
          </span>
        </template>
        <template v-else-if="analysisStatus === 'pending'">
          <span class="w-[3px] h-[3px] rounded-full bg-zinc-300 shrink-0" />
          <span class="inline-flex items-center gap-0.5 text-amber-500 shrink-0" title="AI 分析排队中">
            <Loader2 class="w-3 h-3 animate-spin" />分析中
          </span>
        </template>
      </div>
      <div v-if="excerpt" class="text-[11px] text-zinc-400 truncate mt-0.5">{{ excerpt }}</div>

      <!-- Reading progress bar -->
      <div
        v-if="readStatus === 'reading'"
        class="mt-1.5 h-[3px] rounded-full bg-zinc-200 overflow-hidden"
      >
        <div
          class="h-full bg-amber-500 rounded-full transition-all"
          :style="{ width: `${progressPct}%` }"
        />
      </div>
    </div>

    <div v-if="!selectionMode" class="hidden group-hover:flex absolute right-2 top-1/2 -translate-y-1/2 bg-white/90 backdrop-blur pl-2">
      <button class="p-1 rounded-md text-zinc-500 hover:bg-zinc-100" title="打开原网页" @click.stop="emit('openUrl', document)">
        <ExternalLink class="w-3.5 h-3.5" />
      </button>
      <button class="p-1 rounded-md text-amber-600 hover:bg-amber-50" title="加入合集" @click.stop="emit('addToCollection', document)">
        <FolderPlus class="w-3.5 h-3.5" />
      </button>
      <button class="p-1 rounded-md text-brand hover:bg-brand/10" title="对话" @click.stop="emit('chat', document)">
        <MessageSquare class="w-3.5 h-3.5" />
      </button>
      <button class="p-1 rounded-md text-red-500 hover:bg-red-50" title="删除" @click.stop="emit('delete', document)">
        <Trash2 class="w-3.5 h-3.5" />
      </button>
    </div>
  </article>
</template>
