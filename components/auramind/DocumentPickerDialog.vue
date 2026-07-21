<script lang="ts" setup>
import { ref, computed, watch } from 'vue'
import { X, Search, FileText, CheckSquare, Square } from '@lucide/vue'
import {
  DialogRoot, DialogPortal, DialogOverlay, DialogContent,
  DialogTitle, DialogDescription, DialogClose,
} from 'reka-ui'
import UButton from '@/components/ui/UButton.vue'
import { DocumentRepository } from '@/db/repositories/document.repository'
import { estimateTokens } from '@/utils/token'
import type { DocumentEntity } from '@/types/document'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  close: []
  confirm: [documentIds: string[]]
}>()

const docs = ref<DocumentEntity[]>([])
const selected = ref<Set<string>>(new Set())
const query = ref('')
const loading = ref(false)

// Reload recent docs each time the dialog opens.
watch(() => props.open, async (open) => {
  if (!open) return
  selected.value = new Set()
  query.value = ''
  loading.value = true
  try {
    const all = await DocumentRepository.findAll()
    // Most recent first
    docs.value = all.sort((a, b) =>
      (b.capturedAt ?? '').localeCompare(a.capturedAt ?? ''),
    )
  } finally {
    loading.value = false
  }
}, { immediate: true })

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return docs.value
  return docs.value.filter((d) =>
    d.title?.toLowerCase().includes(q) ||
    d.url?.toLowerCase().includes(q),
  )
})

const totalTokenEstimate = computed(() =>
  [...selected.value]
    .map((id) => docs.value.find((d) => d.id === id)?.tokenCount ?? 0)
    .reduce((sum, n) => sum + n, 0),
)

function toggle(id: string) {
  const next = new Set(selected.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selected.value = next
}

function confirmSelection() {
  if (!selected.value.size) return
  emit('confirm', [...selected.value])
  emit('close')
}
</script>

<template>
  <DialogRoot :open="open" @update:open="(v: boolean) => { if (!v) emit('close') }">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 bg-black/30 z-50" />
      <DialogContent
        class="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[440px] max-h-[80vh] flex flex-col bg-white rounded-2xl shadow-xl z-50 outline-none"
      >
        <div class="p-4 shrink-0">
          <div class="flex items-center justify-between mb-3">
            <DialogTitle class="text-[14px] font-semibold text-zinc-800 flex items-center gap-1.5">
              <FileText class="w-4 h-4 text-brand" />
              选择要分析的文档
            </DialogTitle>
            <DialogClose as-child>
              <button class="p-1 rounded-md text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition">
                <X class="w-3.5 h-3.5" />
              </button>
            </DialogClose>
          </div>
          <DialogDescription class="sr-only">从记忆库选择文档进行 AI 分析</DialogDescription>

          <!-- Search -->
          <div class="relative mb-2">
            <Search class="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              v-model="query"
              type="text"
              placeholder="搜索标题或 URL…"
              class="w-full pl-8 pr-3 py-1.5 text-[12px] bg-zinc-50 border border-zinc-200 rounded-md outline-none focus:border-brand"
            >
          </div>

          <div class="flex items-center justify-between text-[10px] text-zinc-400">
            <span>{{ filtered.length }} 篇{{ query ? '匹配' : '可用' }}</span>
            <span v-if="selected.size" class="text-brand">
              已选 {{ selected.size }} 篇 · ~{{ totalTokenEstimate.toLocaleString() }} tokens
            </span>
          </div>
        </div>

        <!-- Doc list -->
        <div class="flex-1 min-h-0 overflow-y-auto px-2 pb-2">
          <div v-if="loading" class="text-center py-8 text-[12px] text-zinc-400">
            加载中…
          </div>
          <div v-else-if="!filtered.length" class="text-center py-8 text-[12px] text-zinc-400">
            {{ query ? '没有匹配的文档' : '记忆库为空' }}
          </div>
          <div v-else class="flex flex-col gap-0.5">
            <button
              v-for="doc in filtered"
              :key="doc.id"
              class="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-left transition-colors"
              :class="selected.has(doc.id) ? 'bg-brand/10' : 'hover:bg-zinc-50'"
              @click="toggle(doc.id)"
            >
              <component
                :is="selected.has(doc.id) ? CheckSquare : Square"
                class="w-3.5 h-3.5 shrink-0"
                :class="selected.has(doc.id) ? 'text-brand' : 'text-zinc-300'"
              />
              <div class="min-w-0 flex-1">
                <div class="text-[12px] text-zinc-700 truncate">{{ doc.title || doc.url }}</div>
                <div class="text-[9px] text-zinc-400 truncate">{{ doc.url }}</div>
              </div>
              <span class="text-[9px] text-zinc-400 shrink-0 tabular-nums">
                {{ (doc.tokenCount ?? estimateTokens(doc.markdown ?? '')).toLocaleString() }} tok
              </span>
            </button>
          </div>
        </div>

        <!-- Footer -->
        <div class="p-3 shrink-0 border-t border-zinc-100 flex items-center justify-end gap-2">
          <UButton variant="ghost" size="sm" @click="emit('close')">
            取消
          </UButton>
          <UButton
            variant="primary"
            size="sm"
            :disabled="!selected.size"
            @click="confirmSelection"
          >
            下一步 ({{ selected.size }})
          </UButton>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
