<script lang="ts" setup>
import { computed } from 'vue'
import { MessageSquare, Trash2, Globe, ExternalLink } from '@lucide/vue'
import type { DocumentEntity } from '@/types/document'

const props = defineProps<{
  document: DocumentEntity
}>()

const emit = defineEmits<{
  select: [doc: DocumentEntity]
  chat: [doc: DocumentEntity]
  delete: [doc: DocumentEntity]
  openUrl: [doc: DocumentEntity]
}>()

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

const displayTime = computed(() => {
  const date = new Date(props.document.capturedAt)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)

  if (diffMins < 1) return '刚刚'
  if (diffMins < 60) return `${diffMins} 分钟前`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours} 小时前`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays} 天前`

  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
})

const excerpt = computed(() => {
  const text = props.document.excerpt || props.document.markdown || ''
  return text.replace(/[#*_`~>\[\]()!|-]/g, '').slice(0, 150)
})
</script>

<template>
  <article
    class="group relative p-2.5 rounded-xl hover:bg-white border border-transparent hover:border-zinc-200 hover:shadow-sm cursor-pointer transition-all flex gap-3"
    @click="emit('select', document)"
  >
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
      <div class="text-[13px] font-medium truncate group-hover:text-brand">{{ document.title }}</div>
      <div class="text-[11px] text-zinc-500 flex items-center gap-1.5 truncate mt-1">
        <span>{{ domain }}</span>
        <span class="w-[3px] h-[3px] rounded-full bg-zinc-300" />
        <span>{{ displayTime }}</span>
      </div>
      <div v-if="excerpt" class="text-[11px] text-zinc-400 truncate mt-0.5">{{ excerpt }}</div>
    </div>

    <div class="hidden group-hover:flex absolute right-2 top-1/2 -translate-y-1/2 bg-white/90 backdrop-blur pl-2">
      <button class="p-1 rounded-md text-zinc-500 hover:bg-zinc-100" @click.stop="emit('openUrl', document)">
        <ExternalLink class="w-3.5 h-3.5" />
      </button>
      <button class="p-1 rounded-md text-brand hover:bg-indigo-50" @click.stop="emit('chat', document)">
        <MessageSquare class="w-3.5 h-3.5" />
      </button>
      <button class="p-1 rounded-md text-red-500 hover:bg-red-50" @click.stop="emit('delete', document)">
        <Trash2 class="w-3.5 h-3.5" />
      </button>
    </div>
  </article>
</template>
