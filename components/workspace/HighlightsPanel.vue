<script lang="ts" setup>
import dayjs from 'dayjs'
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useDocumentStore } from '@/stores/document.store'
import { formatLocal, formatRelative } from '@/utils/date'
import { useChatStore } from '@/stores/chat.store'
import { useAppStore } from '@/stores/app.store'
import { HighlightColors } from '@/components/workspace/highlight-colors'
import type { Highlight, HighlightColor } from '@/types/document'

const documentStore = useDocumentStore()
const chatStore = useChatStore()
const appStore = useAppStore()

const highlights = computed(() => documentStore.currentDocument?.highlights ?? [])

// ── Filtering & Search ────────────────────────────────
const searchQuery = ref('')
const filterColor = ref<HighlightColor | 'all'>('all')

const filteredHighlights = computed(() => {
  let result = highlights.value
  if (filterColor.value !== 'all') {
    result = result.filter((h) => (h.color ?? 'yellow') === filterColor.value)
  }
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.trim().toLowerCase()
    result = result.filter(
      (h) => h.text.toLowerCase().includes(q) || (h.note?.toLowerCase().includes(q) ?? false),
    )
  }
  return result
})

// ── Stats ─────────────────────────────────────────────
const stats = computed(() => {
  const total = highlights.value.length
  const byColor: Record<string, number> = {}
  for (const c of HighlightColors) {
    byColor[c.color] = highlights.value.filter((h) => (h.color ?? 'yellow') === c.color).length
  }
  const withNotes = highlights.value.filter((h) => h.note).length
  return { total, byColor, withNotes }
})

// ── Selection (batch ops) ─────────────────────────────
const selectedIds = ref<Set<string>>(new Set())
const selectAll = ref(false)

function toggleSelectAll() {
  if (selectAll.value) {
    selectedIds.value = new Set(filteredHighlights.value.map((h) => h.id))
  } else {
    selectedIds.value = new Set()
  }
}

function toggleSelect(id: string) {
  const next = new Set(selectedIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selectedIds.value = next
}

// ── Actions ───────────────────────────────────────────
async function batchDelete() {
  if (!documentStore.currentDocument || selectedIds.value.size === 0) return
  const count = selectedIds.value.size
  if (!confirm(`确定删除 ${count} 条标注？`)) return
  await documentStore.removeHighlights(
    documentStore.currentDocument.id,
    [...selectedIds.value],
  )
  selectedIds.value = new Set()
  selectAll.value = false
  appStore.showToast(`已删除 ${count} 条标注`, 'success')
}

async function changeColor(hl: Highlight, color: HighlightColor) {
  if (!documentStore.currentDocument) return
  await documentStore.updateHighlightColor(documentStore.currentDocument.id, hl.id, color)
}

async function deleteHighlight(hl: Highlight) {
  if (!documentStore.currentDocument) return
  await documentStore.removeHighlight(documentStore.currentDocument.id, hl.id)
}

async function addNote(hl: Highlight) {
  const note = window.prompt('编辑批注', hl.note ?? '')
  if (note === null) return
  if (!documentStore.currentDocument) return
  await documentStore.updateHighlightNote(documentStore.currentDocument.id, hl.id, note.trim())
}

function sendToChat(hl: Highlight) {
  const snippet = hl.note ? `> ${hl.text}\n\n批注: ${hl.note}` : `> ${hl.text}`
  const current = chatStore.inputText.trim()
  chatStore.setInputText(current ? `${current}\n\n${snippet}` : snippet)
  appStore.showToast('已发送到对话框', 'success')
}

// ── Export ────────────────────────────────────────────
type ExportFormat = 'markdown' | 'json' | 'clipboard'

function exportHighlights(format: ExportFormat) {
  const hls = filteredHighlights.value
  if (!hls.length) return

  let content = ''
  let filename = ''
  let mime = ''

  if (format === 'markdown') {
    content = `# 标注导出\n\n**文档**: ${documentStore.currentDocument?.title ?? '未命名'}\n**来源**: ${documentStore.currentDocument?.url ?? ''}\n**导出时间**: ${formatLocal()}\n**标注数量**: ${hls.length}\n\n---\n\n`
    for (const hl of hls) {
      const colorLabel = HighlightColors.find((c) => c.color === (hl.color ?? 'yellow'))?.label ?? '黄色'
      content += `## ${colorLabel}\n\n> ${hl.text}\n\n`
      if (hl.note) content += `**批注**: ${hl.note}\n\n`
      content += `---\n\n`
    }
    filename = `highlights-${dayjs().valueOf()}.md`
    mime = 'text/markdown'
  } else if (format === 'json') {
    content = JSON.stringify(
      {
        document: {
          title: documentStore.currentDocument?.title,
          url: documentStore.currentDocument?.url,
        },
        exportedAt: dayjs().toISOString(),
        count: hls.length,
        highlights: hls,
      },
      null,
      2,
    )
    filename = `highlights-${dayjs().valueOf()}.json`
    mime = 'application/json'
  } else if (format === 'clipboard') {
    content = hls.map((h) => {
      const note = h.note ? `\n  批注: ${h.note}` : ''
      return `> ${h.text}${note}`
    }).join('\n\n')
  }

  if (format === 'clipboard') {
    navigator.clipboard.writeText(content).then(() => {
      appStore.showToast(`已复制 ${hls.length} 条标注`, 'success')
    }).catch(() => {
      appStore.showToast('复制失败', 'error')
    })
    return
  }

  // Download file
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
  appStore.showToast(`已导出 ${hls.length} 条标注`, 'success')
}

// ── Jump to highlight in document ─────────────────────
const emit = defineEmits<{ (e: 'jump', hl: Highlight): void }>()

function jumpTo(hl: Highlight) {
  emit('jump', hl)
}

// ── Keyboard shortcuts (1-5 for color selection) ─────
// These are handled in MarkdownPreview; here we only handle
// select-all via Cmd/Ctrl+A when the panel has focus.
function handleKeydown(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.key === 'a' && highlights.value.length) {
    e.preventDefault()
    selectAll.value = true
    toggleSelectAll()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})
onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})

// ── Date formatting ───────────────────────────────────
const formatTime = (iso: string) => formatRelative(iso).replace(/(分钟|小时|天)前$/, ' $1前')
</script>

<template>
  <div class="flex-1 min-h-0 overflow-hidden flex flex-col bg-white">
    <!-- ── Stats bar ──────────────────────────────── -->
    <div v-if="highlights.length" class="shrink-0 px-4 py-2.5 border-b border-zinc-100 bg-zinc-50/50">
      <div class="flex items-center gap-3">
        <!-- Total -->
        <div class="flex items-center gap-1.5">
          <span class="text-[18px] font-semibold text-zinc-800">{{ stats.total }}</span>
          <span class="text-[10px] text-zinc-400">标注</span>
        </div>
        <div class="w-px h-4 bg-zinc-200" />
        <!-- Color distribution -->
        <div class="flex items-center gap-1.5">
          <button
            v-for="c in HighlightColors"
            :key="c.color"
            class="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] transition-colors"
            :class="filterColor === c.color ? 'bg-zinc-200 text-zinc-700' : 'text-zinc-400 hover:text-zinc-600'"
            @click="filterColor = filterColor === c.color ? 'all' : c.color"
          >
            <span
              class="w-2 h-2 rounded-full"
              :style="{ background: `var(--hl-${c.color}-bg)` }"
            />
            {{ stats.byColor[c.color] }}
          </button>
        </div>
        <div class="w-px h-4 bg-zinc-200" />
        <!-- With notes -->
        <div class="text-[10px] text-zinc-400">
          {{ stats.withNotes }} 条含批注
        </div>
      </div>
    </div>

    <!-- ── Search + actions bar ───────────────────── -->
    <div v-if="highlights.length" class="shrink-0 px-3 py-2 border-b border-zinc-100 flex items-center gap-2">
      <input
        v-model="searchQuery"
        type="text"
        placeholder="搜索标注或批注..."
        class="flex-1 h-7 px-2.5 text-[12px] bg-zinc-50 border border-zinc-200 rounded-md focus:outline-none focus:border-brand focus:bg-white transition-colors"
      />
      <!-- Export dropdown -->
      <div class="relative group">
        <button
          class="h-7 px-2 flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100 rounded-md transition-colors"
          title="导出标注"
        >
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
          导出
        </button>
        <div class="absolute right-0 top-full mt-1 bg-white border border-zinc-200 rounded-lg shadow-lg py-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-20 min-w-[120px]">
          <button class="w-full text-left px-3 py-1.5 text-[11px] text-zinc-600 hover:bg-zinc-50" @click="exportHighlights('markdown')">Markdown</button>
          <button class="w-full text-left px-3 py-1.5 text-[11px] text-zinc-600 hover:bg-zinc-50" @click="exportHighlights('json')">JSON</button>
          <button class="w-full text-left px-3 py-1.5 text-[11px] text-zinc-600 hover:bg-zinc-50" @click="exportHighlights('clipboard')">复制到剪贴板</button>
        </div>
      </div>
    </div>

    <!-- ── Batch action bar ──────────────────────── -->
    <div v-if="selectedIds.size > 0" class="shrink-0 px-3 py-1.5 bg-brand-50 border-b border-brand-100 flex items-center gap-2">
      <span class="text-[11px] text-brand-700 font-medium">已选 {{ selectedIds.size }} 项</span>
      <div class="flex-1" />
      <button
        class="text-[11px] text-red-500 hover:text-red-600 hover:bg-red-50 px-2 py-0.5 rounded transition-colors"
        @click="batchDelete"
      >
        批量删除
      </button>
      <button
        class="text-[11px] text-zinc-500 hover:text-zinc-700 px-2 py-0.5 rounded transition-colors"
        @click="selectedIds = new Set(); selectAll = false"
      >
        取消
      </button>
    </div>

    <!-- ── Highlights list ───────────────────────── -->
    <div class="flex-1 overflow-y-auto">
      <template v-if="filteredHighlights.length">
        <!-- Select all -->
        <div v-if="highlights.length" class="sticky top-0 z-10 px-3 py-1.5 bg-white/90 backdrop-blur border-b border-zinc-100 flex items-center gap-2">
          <input
            v-model="selectAll"
            type="checkbox"
            class="w-3 h-3 accent-brand"
            @change="toggleSelectAll"
          />
          <span class="text-[10px] text-zinc-400">全选</span>
        </div>

        <div
          v-for="hl in filteredHighlights"
          :key="hl.id"
          class="group px-3 py-2.5 border-b border-zinc-50 hover:bg-zinc-50/80 transition-colors"
          :class="{ 'bg-brand-50/30': selectedIds.has(hl.id) }"
        >
          <div class="flex items-start gap-2">
            <!-- Checkbox -->
            <input
              type="checkbox"
              :checked="selectedIds.has(hl.id)"
              class="w-3 h-3 mt-0.5 accent-brand shrink-0"
              @change="toggleSelect(hl.id)"
            />
            <!-- Color dot -->
            <button
              class="w-2.5 h-2.5 rounded-full shrink-0 mt-0.5 ring-1 ring-zinc-200"
              :style="{ background: `var(--hl-${hl.color ?? 'yellow'}-bg)` }"
              :title="HighlightColors.find(c => c.color === (hl.color ?? 'yellow'))?.label"
              @click="changeColor(hl, HighlightColors[(HighlightColors.findIndex(c => c.color === (hl.color ?? 'yellow')) + 1) % HighlightColors.length].color)"
            />
            <!-- Content -->
            <div class="flex-1 min-w-0 cursor-pointer" @click="jumpTo(hl)">
              <div class="text-[12px] text-zinc-700 leading-relaxed line-clamp-3">{{ hl.text }}</div>
              <div v-if="hl.note" class="mt-1 text-[11px] text-zinc-500 bg-zinc-50 rounded px-1.5 py-1 line-clamp-2">
                {{ hl.note }}
              </div>
              <div class="mt-1 flex items-center gap-2 text-[10px] text-zinc-300">
                <span>{{ formatTime(hl.createdAt) }}</span>
                <span v-if="hl.updatedAt !== hl.createdAt">· 编辑过</span>
              </div>
            </div>
            <!-- Actions -->
            <div class="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              <button
                class="p-1 rounded text-zinc-400 hover:text-brand hover:bg-white"
                title="发送到对话框"
                @click="sendToChat(hl)"
              >
                <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
              </button>
              <button
                class="p-1 rounded text-zinc-400 hover:text-brand hover:bg-white"
                title="编辑批注"
                @click="addNote(hl)"
              >
                <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
              <button
                class="p-1 rounded text-zinc-400 hover:text-red-500 hover:bg-white"
                title="删除"
                @click="deleteHighlight(hl)"
              >
                <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </button>
            </div>
          </div>
        </div>
      </template>

      <!-- Empty states -->
      <div v-else-if="highlights.length === 0" class="flex flex-col items-center justify-center py-16 text-center">
        <svg class="w-10 h-10 text-zinc-200 mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/>
        </svg>
        <div class="text-[12px] text-zinc-400">暂无标注</div>
        <div class="text-[11px] text-zinc-300 mt-1">在 Markdown 标签页中选中文字即可创建标注</div>
      </div>
      <div v-else class="flex flex-col items-center justify-center py-16 text-center">
        <div class="text-[12px] text-zinc-400">未找到匹配的标注</div>
        <button
          class="mt-2 text-[11px] text-brand hover:underline"
          @click="searchQuery = ''; filterColor = 'all'"
        >
          清除筛选
        </button>
      </div>
    </div>
  </div>
</template>
