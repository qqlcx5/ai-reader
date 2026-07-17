<script lang="ts" setup>
import dayjs from 'dayjs'
import { computed, watch, ref, nextTick, onMounted, onUnmounted } from 'vue'
import { useDocumentStore } from '@/stores/document.store'
import { useChatStore } from '@/stores/chat.store'
import { useAppStore } from '@/stores/app.store'
import { renderMarkdown, enhanceCodeBlocks } from '@/utils/markdown'
import { HighlightColors } from '@/components/workspace/highlight-colors'
import type { Highlight, HighlightColor } from '@/types/document'

const documentStore = useDocumentStore()
const chatStore = useChatStore()
const appStore = useAppStore()

const scrollRef = ref<HTMLElement | null>(null)
const containerRef = ref<HTMLElement | null>(null)

const rawMarkdown = computed(() => documentStore.currentDocument?.markdown || '')
const highlights = computed(() => documentStore.currentDocument?.highlights ?? [])

const renderedHtml = computed(() => renderMarkdown(rawMarkdown.value))

// ── Reading progress tracking ──────────────────────────
let lastReportedProgress = -1
let rafId: number | null = null
let throttleTimer: ReturnType<typeof setTimeout> | null = null

function computeProgress(): number {
  const el = scrollRef.value
  if (!el) return 0
  const { scrollTop, scrollHeight, clientHeight } = el
  if (scrollHeight <= clientHeight) return 1
  const maxScroll = scrollHeight - clientHeight
  if (maxScroll <= 0) return 1
  return Math.min(1, scrollTop / maxScroll)
}

function reportProgress() {
  const doc = documentStore.currentDocument
  if (!doc) return
  const p = computeProgress()
  if (p - lastReportedProgress < 0.03 && p < 1) return
  lastReportedProgress = p
  documentStore.updateReadProgress(doc.id, p)
}

function onScroll() {
  if (throttleTimer) return
  throttleTimer = setTimeout(() => {
    throttleTimer = null
    if (rafId) cancelAnimationFrame(rafId)
    rafId = requestAnimationFrame(reportProgress)
  }, 200)
}

// ── Highlight rendering: DOM post-processing ──────────────
// After v-html renders, walk all text nodes and wrap highlight ranges
// with <mark>. v-html re-render replaces the entire DOM subtree so
// old marks are gone — no need to clearMarks first.
//
// For each highlight, we search the DOM text for hl.text and wrap the
// first match. This avoids fragile offset mapping across markdown→HTML.

function clearMarks(container: HTMLElement) {
  const marks = container.querySelectorAll('mark[data-hl-id]')
  for (const mark of marks) {
    const parent = mark.parentNode
    if (!parent) continue
    // Move children out of <mark> into parent, then remove <mark>
    while (mark.firstChild) {
      parent.insertBefore(mark.firstChild, mark)
    }
    parent.removeChild(mark)
    // Normalize adjacent text nodes back together
    parent.normalize()
  }
}

function applyMarks(container: HTMLElement, hls: Highlight[]) {
  clearMarks(container)
  if (!hls.length) return

  for (const hl of hls) {
    if (!hl.text) continue
    wrapTextInContainer(container, hl)
  }
}

/** Find hl.text in the container's text nodes and wrap it in a <mark>. */
function wrapTextInContainer(container: HTMLElement, hl: Highlight): boolean {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement
      if (!parent) return NodeFilter.FILTER_REJECT
      const tag = parent.tagName
      if (tag === 'SCRIPT' || tag === 'STYLE') return NodeFilter.FILTER_REJECT
      // Don't wrap inside an existing mark
      if (parent.closest('mark[data-hl-id]')) return NodeFilter.FILTER_REJECT
      if (!node.nodeValue) return NodeFilter.FILTER_REJECT
      return NodeFilter.FILTER_ACCEPT
    },
  })

  // Collect text nodes with their cumulative offset
  const textNodes: { node: Text; start: number; text: string }[] = []
  let cumulative = 0
  let n: Node | null
  while ((n = walker.nextNode())) {
    const tn = n as Text
    const text = tn.nodeValue!
    textNodes.push({ node: tn, start: cumulative, text })
    cumulative += text.length
  }

  // Build full DOM text and find the highlight text
  const domText = textNodes.map((t) => t.text).join('')
  const idx = domText.indexOf(hl.text)
  if (idx === -1) return false

  const endIdx = idx + hl.text.length

  // Find which text nodes the range [idx, endIdx) spans
  const startNode = textNodes.find((t) => idx >= t.start && idx < t.start + t.text.length)
  const endNode = textNodes.find((t) => endIdx > t.start && endIdx <= t.start + t.text.length)
  if (!startNode || !endNode) return false

  const color = hl.color ?? 'yellow'
  const mark = document.createElement('mark')
  mark.dataset.hlId = hl.id
  mark.className = `hl-mark hl-${color}`
  if (hl.note) mark.title = hl.note

  // Case 1: single text node — simple split + wrap
  if (startNode.node === endNode.node) {
    const tn = startNode.node
    const localStart = idx - startNode.start
    const localEnd = endIdx - startNode.start
    const range = document.createRange()
    range.setStart(tn, localStart)
    range.setEnd(tn, localEnd)
    range.surroundContents(mark)
    return true
  }

  // Case 2: spans multiple text nodes
  // Split start node: keep text before idx, wrap the rest
  const startLocal = idx - startNode.start
  if (startLocal > 0) {
    startNode.node.splitText(startLocal)
    // After split, the second part is what we want
    // Re-find the node — splitText returns the new node
  }

  // Re-collect text nodes after split (simpler than tracking pointers)
  // Actually, let's use a Range which handles cross-node wrapping
  try {
    // Re-find nodes after potential split
    const walker2 = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement
        if (!parent) return NodeFilter.FILTER_REJECT
        if (parent.tagName === 'SCRIPT' || parent.tagName === 'STYLE') return NodeFilter.FILTER_REJECT
        if (parent.closest('mark[data-hl-id]')) return NodeFilter.FILTER_REJECT
        if (!node.nodeValue) return NodeFilter.FILTER_REJECT
        return NodeFilter.FILTER_ACCEPT
      },
    })

    const nodes2: { node: Text; start: number; text: string }[] = []
    let cum2 = 0
    let m: Node | null
    while ((m = walker2.nextNode())) {
      const tn = m as Text
      const text = tn.nodeValue!
      nodes2.push({ node: tn, start: cum2, text })
      cum2 += text.length
    }

    const domText2 = nodes2.map((t) => t.text).join('')
    const idx2 = domText2.indexOf(hl.text)
    if (idx2 === -1) return false
    const endIdx2 = idx2 + hl.text.length

    const sn = nodes2.find((t) => idx2 >= t.start && idx2 < t.start + t.text.length)
    const en = nodes2.find((t) => endIdx2 > t.start && endIdx2 <= t.start + t.text.length)
    if (!sn || !en) return false

    const range = document.createRange()
    range.setStart(sn.node, idx2 - sn.start)
    range.setEnd(en.node, endIdx2 - en.start)

    // extractContents + insertNode handles cross-node ranges
    const contents = range.extractContents()
    mark.appendChild(contents)
    range.insertNode(mark)
    return true
  } catch {
    return false
  }
}

// Re-apply marks whenever content or highlights change.
// When renderedHtml changes, v-html replaces the DOM subtree (marks gone).
// When only highlights change, clearMarks() unwraps old marks before re-wrapping.
watch([renderedHtml, highlights], async () => {
  await nextTick()
  const container = containerRef.value
  if (!container) return
  applyMarks(container, highlights.value)
  enhanceCodeBlocks(container)
}, { flush: 'post' })

// ── Text selection → highlight toolbar ─────────────────────

const selectionToolbar = ref<{
  visible: boolean
  x: number
  y: number
  selectedText: string
  startOffset: number
} | null>(null)

const HIGHLIGHT_COLORS: { color: HighlightColor; label: string }[] = HighlightColors

let suppressClear = false

// ── Click existing mark → action popover ──────────────────
const markPopover = ref<{
  visible: boolean
  x: number
  y: number
  highlight: Highlight | null
} | null>(null)

function findHighlightByMarkId(markEl: HTMLElement): Highlight | undefined {
  const id = markEl.dataset.hlId
  if (!id) return undefined
  return highlights.value.find((h) => h.id === id)
}

function handleMarkClick(e: MouseEvent) {
  const target = e.target as HTMLElement
  const markEl = target.closest('mark[data-hl-id]') as HTMLElement | null
  if (!markEl) return

  const hl = findHighlightByMarkId(markEl)
  if (!hl) return

  e.preventDefault()
  e.stopPropagation()

  const markRect = markEl.getBoundingClientRect()

  suppressClear = true
  setTimeout(() => { suppressClear = false }, 300)

  markPopover.value = {
    visible: true,
    x: e.clientX,
    y: markRect.bottom + 4,
    highlight: hl,
  }
}

function closeMarkPopover(e?: Event) {
  // If clicking inside the popover, don't close
  if (e) {
    const target = e.target as HTMLElement
    if (target.closest('.mark-popover')) return
    // If clicking a mark, let handleMarkClick handle it
    if (target.closest('mark[data-hl-id]')) return
  }
  markPopover.value = null
}

async function popoverChangeColor(color: HighlightColor) {
  if (!markPopover.value?.highlight || !documentStore.currentDocument) return
  await documentStore.updateHighlightColor(documentStore.currentDocument.id, markPopover.value.highlight.id, color)
  closeMarkPopover()
}

async function popoverDelete() {
  if (!markPopover.value?.highlight || !documentStore.currentDocument) return
  await documentStore.removeHighlight(documentStore.currentDocument.id, markPopover.value.highlight.id)
  closeMarkPopover()
}

async function popoverAddNote() {
  if (!markPopover.value?.highlight || !documentStore.currentDocument) return
  const hl = markPopover.value.highlight
  closeMarkPopover()
  const note = window.prompt('编辑批注', hl.note ?? '')
  if (note === null) return
  await documentStore.updateHighlightNote(documentStore.currentDocument.id, hl.id, note.trim())
}

function popoverSendToChat() {
  if (!markPopover.value?.highlight) return
  const hl = markPopover.value.highlight
  const snippet = hl.note ? `> ${hl.text}\n\n批注: ${hl.note}` : `> ${hl.text}`
  const current = chatStore.inputText.trim()
  chatStore.setInputText(current ? `${current}\n\n${snippet}` : snippet)
  appStore.showToast('已发送到对话框', 'success')
  closeMarkPopover()
}

function handleMouseUp() {
  const sel = window.getSelection()
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
    selectionToolbar.value = null
    return
  }

  const selectedText = sel.toString().trim()
  if (!selectedText || selectedText.length < 2) {
    selectionToolbar.value = null
    return
  }

  const range = sel.getRangeAt(0)
  const container = containerRef.value
  if (!container || !container.contains(range.commonAncestorContainer)) {
    selectionToolbar.value = null
    return
  }

  const startOffset = rawMarkdown.value.indexOf(selectedText)
  if (startOffset === -1) {
    selectionToolbar.value = null
    return
  }

  const rect = range.getBoundingClientRect()

  suppressClear = true
  setTimeout(() => { suppressClear = false }, 300)

  selectionToolbar.value = {
    visible: true,
    x: rect.left + rect.width / 2,
    y: rect.top - 8,
    selectedText,
    startOffset,
  }
}

function handleSelectionClear() {
  if (suppressClear) return
  setTimeout(() => {
    if (suppressClear) return
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed) {
      selectionToolbar.value = null
    }
    // Also close mark popover on selection clear
    if (markPopover.value && !sel?.toString().trim()) {
      markPopover.value = null
    }
  }, 200)
}

async function createHighlight(color: HighlightColor) {
  if (!selectionToolbar.value || !documentStore.currentDocument) {
    selectionToolbar.value = null
    return
  }

  const { selectedText, startOffset } = selectionToolbar.value
  const docId = documentStore.currentDocument.id
  const now = dayjs().toISOString()

  const hl: Highlight = {
    id: crypto.randomUUID(),
    startOffset,
    endOffset: startOffset + selectedText.length,
    text: selectedText,
    color,
    createdAt: now,
    updatedAt: now,
  }

  selectionToolbar.value = null
  window.getSelection()?.removeAllRanges()

  await documentStore.addHighlight(docId, hl)
  appStore.showToast('已标注', 'success')
}

function sendHighlightToChat(hl: Highlight) {
  const snippet = hl.note
    ? `> ${hl.text}\n\n批注: ${hl.note}`
    : `> ${hl.text}`
  const current = chatStore.inputText.trim()
  chatStore.setInputText(current ? `${current}\n\n${snippet}` : snippet)
  appStore.showToast('已发送到对话框', 'success')
}

async function deleteHighlight(hl: Highlight) {
  if (!documentStore.currentDocument) return
  await documentStore.removeHighlight(documentStore.currentDocument.id, hl.id)
}

async function addNoteToHighlight(hl: Highlight) {
  const note = window.prompt('添加批注', hl.note ?? '')
  if (note === null) return
  if (!documentStore.currentDocument) return
  await documentStore.updateHighlightNote(documentStore.currentDocument.id, hl.id, note.trim())
}

/** Jump to a highlight in the rendered content and flash it. */
function jumpToHighlight(hl: Highlight) {
  const container = containerRef.value
  if (!container) return
  const mark = container.querySelector(`mark[data-hl-id="${hl.id}"]`) as HTMLElement | null
  if (!mark) return
  mark.scrollIntoView({ behavior: 'smooth', block: 'center' })
  mark.classList.add('hl-flash')
  setTimeout(() => mark.classList.remove('hl-flash'), 1500)
}

defineExpose({ jumpToHighlight })

onMounted(() => {
  document.addEventListener('selectionchange', handleSelectionClear)
  document.addEventListener('click', closeMarkPopover, { capture: true })
  const progress = documentStore.currentDocument?.readProgress
  if (progress != null && progress > 0 && progress < 1 && scrollRef.value) {
    nextTick(() => {
      const el = scrollRef.value
      if (!el) return
      const maxScroll = el.scrollHeight - el.clientHeight
      el.scrollTop = maxScroll * progress
      lastReportedProgress = progress
    })
  }
})

onUnmounted(() => {
  document.removeEventListener('selectionchange', handleSelectionClear)
  document.removeEventListener('click', closeMarkPopover, { capture: true })
  if (throttleTimer) clearTimeout(throttleTimer)
  if (rafId) cancelAnimationFrame(rafId)
  reportProgress()
})
</script>

<template>
  <div ref="scrollRef" class="flex-1 overflow-y-auto p-5 relative" @scroll="onScroll">
    <div
      v-if="rawMarkdown"
      ref="containerRef"
      class="md-render"
      v-html="renderedHtml"
      @mouseup="handleMouseUp"
      @click="handleMarkClick"
    />

    <!-- Selection toolbar: shows color dots when text is selected -->
    <div
      v-if="selectionToolbar?.visible"
      class="fixed z-50 flex items-center gap-0.5 bg-white border border-zinc-200 rounded-lg shadow-lg px-1 py-1"
      :style="{ left: `${selectionToolbar.x}px`, top: `${selectionToolbar.y}px`, transform: 'translate(-50%, -100%)' }"
      @mousedown.prevent
    >
      <button
        v-for="c in HIGHLIGHT_COLORS"
        :key="c.color"
        class="w-5 h-5 rounded-full border border-zinc-200 hover:scale-110 transition-transform"
        :style="{ background: `var(--hl-${c.color}-bg)` }"
        :title="c.label"
        @mousedown.prevent="createHighlight(c.color)"
      />
    </div>

    <!-- Mark popover: shows actions when clicking an existing highlight -->
    <div
      v-if="markPopover?.visible && markPopover.highlight"
      class="mark-popover fixed z-50 bg-white border border-zinc-200 rounded-lg shadow-lg py-1 min-w-[160px]"
      :style="{ left: `${markPopover.x}px`, top: `${markPopover.y}px`, transform: 'translate(-50%, 0)' }"
      @click.stop
      @mousedown.stop
    >
      <!-- Color row -->
      <div class="flex items-center gap-1 px-2 py-1">
        <button
          v-for="c in HIGHLIGHT_COLORS"
          :key="c.color"
          class="w-4 h-4 rounded-full border transition-transform hover:scale-115"
          :class="(markPopover.highlight.color ?? 'yellow') === c.color ? 'border-zinc-800 ring-1 ring-zinc-300' : 'border-zinc-200'"
          :style="{ background: `var(--hl-${c.color}-bg)` }"
          :title="c.label"
          @click="popoverChangeColor(c.color)"
        />
      </div>
      <div class="h-px bg-zinc-100 my-1" />
      <!-- Actions -->
      <button
        class="w-full flex items-center gap-1.5 px-2.5 py-1 text-[11px] text-zinc-600 hover:bg-zinc-50 transition-colors text-left"
        @click="popoverSendToChat"
      >
        <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
        发送到对话框
      </button>
      <button
        class="w-full flex items-center gap-1.5 px-2.5 py-1 text-[11px] text-zinc-600 hover:bg-zinc-50 transition-colors text-left"
        @click="popoverAddNote"
      >
        <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        {{ markPopover.highlight.note ? '编辑批注' : '添加批注' }}
      </button>
      <div class="h-px bg-zinc-100 my-1" />
      <button
        class="w-full flex items-center gap-1.5 px-2.5 py-1 text-[11px] text-red-500 hover:bg-red-50 transition-colors text-left"
        @click="popoverDelete"
      >
        <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        取消高亮
      </button>
    </div>

    <!-- Highlight count hint (full list in 标注 tab) -->
    <div
      v-if="rawMarkdown && highlights.length"
      class="mt-4 border-t border-zinc-200 pt-2 flex items-center justify-between"
    >
      <div class="text-[11px] text-zinc-400">
        {{ highlights.length }} 条标注 · 切换到「标注」标签页查看全部
      </div>
    </div>

    <div v-if="!rawMarkdown" class="text-zinc-400 text-[13px] py-8 text-center">
      暂无 Markdown 内容
    </div>
  </div>
</template>

<style scoped>
:deep(.hl-mark) {
  border-radius: 2px;
  padding: 0 1px;
  cursor: pointer;
  transition: filter 0.15s;
}
:deep(.hl-mark:hover) {
  filter: brightness(0.92);
}
:deep(.hl-yellow) { background: rgba(250, 204, 21, 0.3); border-bottom: 1px solid rgba(202, 138, 4, 0.4); }
:deep(.hl-green)  { background: rgba(34, 197, 94, 0.2);  border-bottom: 1px solid rgba(22, 101, 52, 0.4); }
:deep(.hl-blue)   { background: rgba(59, 130, 246, 0.2); border-bottom: 1px solid rgba(30, 58, 138, 0.4); }
:deep(.hl-pink)   { background: rgba(236, 72, 153, 0.2); border-bottom: 1px solid rgba(157, 23, 77, 0.4); }
:deep(.hl-purple) { background: rgba(168, 85, 247, 0.2); border-bottom: 1px solid rgba(107, 33, 168, 0.4); }

/* Flash animation when jumping to a highlight from the panel */
:deep(.hl-flash) {
  animation: hl-flash 1.5s ease-out;
}
@keyframes hl-flash {
  0%, 30% { box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.5); }
  100% { box-shadow: 0 0 0 0 transparent; }
}
</style>
