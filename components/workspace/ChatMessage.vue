<script lang="ts" setup>
import { computed, ref, watch, nextTick, onUnmounted } from 'vue'
import { Sparkles, ChevronDown, ChevronRight, RefreshCw, Copy, Trash2, Pencil, Clipboard, GitBranch, Paperclip } from '@lucide/vue'
import { renderMarkdown, enhanceCodeBlocks } from '@/utils/markdown'
import { formatMessageForCopy, copyToClipboard } from '@/utils/conversation-export'
import type { ChatMessage } from '@/types/chat'

const props = defineProps<{
  message: ChatMessage
  modelName?: string
  /** Whether this message is part of a multi-model round (influences layout) */
  isMultiModel?: boolean
  /** Whether this is the last assistant message (to show regenerate) */
  isLastAssistant?: boolean
  /** Token usage + cost summary, e.g. "1.5k · ¥0.003" */
  meta?: string
  /** When set, renders a compact "📄 {label}" tag inside a user bubble to
   *  indicate the conversation's bound page context. Only passed for the
   *  first user message of a conversation (option 3: context lives on the
   *  document, not in the message, so later messages need no tag). */
  contextLabel?: string
}>()

const emit = defineEmits<{
  (e: 'regenerate', id: string): void
  (e: 'copy', content: string): void
  (e: 'delete', id: string): void
  (e: 'edit', id: string, content: string): void
  (e: 'branch', id: string): void
  (e: 'restore', id: string): void
}>()

const isUser = computed(() => props.message.role === 'user')
const isStreaming = computed(() => props.message.status === 'streaming')
const isFailed = computed(() => props.message.status === 'failed')
const isAborted = computed(() => props.message.status === 'aborted')
const statusLabel = computed(() => {
  if (isFailed.value) return '失败'
  if (isAborted.value) return '已停止'
  if (isStreaming.value && props.message.reasoningContent && !props.message.content) return '思考中'
  if (isStreaming.value) return '生成中'
  if (props.message.status === 'pending' || props.message.status === 'sending') return '准备中'
  return '已完成'
})

const isHovered = ref(false)
const thinkingExpanded = ref(false)
const contentRef = ref<HTMLElement | null>(null)
const copied = ref(false)

/** Copy this message as formatted Markdown (includes role label + thinking). */
async function handleCopyAsMarkdown() {
  const text = formatMessageForCopy(props.message)
  const ok = await copyToClipboard(text)
  if (ok) {
    copied.value = true
    setTimeout(() => (copied.value = false), 1500)
  }
}

/** Copy raw content only (original behavior). */
function handleCopyRaw() {
  emit('copy', props.message.content)
}

// Markdown rendering. During streaming we re-render throttled (leading +
// trailing edge) so live markdown feels smooth; hljs highlight + copy-button
// wrapping are deferred to the final non-streaming render to avoid per-chunk
// flicker and highlight.js CPU spikes.
const displayedHtml = ref('')
const shouldRender = computed(
  () => !isUser.value && !isFailed.value && !isAborted.value && !!props.message.content,
)

let renderTimer: ReturnType<typeof setTimeout> | null = null
let lastRenderAt = 0
const STREAM_THROTTLE_MS = 80

function flushRender() {
  renderTimer = null
  lastRenderAt = Date.now()
  displayedHtml.value = renderMarkdown(props.message.content || '')
  if (!isStreaming.value) {
    void nextTick(() => {
      if (contentRef.value) enhanceCodeBlocks(contentRef.value)
    })
  }
}

function scheduleRender() {
  if (!shouldRender.value) {
    if (renderTimer != null) {
      clearTimeout(renderTimer)
      renderTimer = null
    }
    displayedHtml.value = ''
    return
  }
  if (!isStreaming.value) {
    if (renderTimer != null) {
      clearTimeout(renderTimer)
      renderTimer = null
    }
    flushRender()
    return
  }
  // Streaming: leading-edge (render the first chunk now so the bubble isn't
  // empty), then throttle subsequent chunks to ~one re-render per 80ms.
  const elapsed = Date.now() - lastRenderAt
  if (elapsed >= STREAM_THROTTLE_MS) {
    flushRender()
  } else if (renderTimer == null) {
    renderTimer = setTimeout(flushRender, STREAM_THROTTLE_MS - elapsed)
  }
}

watch(
  [() => props.message.content, () => props.message.status],
  scheduleRender,
  { immediate: true },
)

onUnmounted(() => {
  if (renderTimer != null) clearTimeout(renderTimer)
})
</script>

<template>
  <!-- User message -->
  <div
    v-if="isUser"
    class="flex justify-end group"
    @mouseenter="isHovered = true"
    @mouseleave="isHovered = false"
  >
    <!-- Action buttons (appear on hover, left side) -->
    <div
      v-show="isHovered"
      class="flex items-center gap-0.1 self-center opacity-0 group-hover:opacity-100 transition-opacity"
    >
      <button
        class="w-6 flex items-center justify-center rounded text-zinc-400 hover:text-brand hover:bg-brand/5 transition-colors"
        title="编辑"
        @click.stop="emit('edit', message.id, message.content)"
      >
        <Pencil class="w-3 h-3" />
      </button>
      <button
        class="w-6 flex items-center justify-center rounded text-zinc-400 hover:text-brand hover:bg-brand/5 transition-colors"
        :title="copied ? '已复制!' : '复制为 Markdown'"
        @click.stop="handleCopyAsMarkdown"
      >
        <Clipboard v-if="copied" class="w-3 h-3 text-emerald-500" />
        <Copy v-else class="w-3 h-3" />
      </button>
      <button
        class="w-6 flex items-center justify-center rounded text-zinc-400 hover:text-brand hover:bg-brand/5 transition-colors"
        title="从此处分支"
        @click.stop="emit('branch', message.id)"
      >
        <GitBranch class="w-3 h-3" />
      </button>
      <button
        class="w-6 flex items-center justify-center rounded text-zinc-400 hover:text-red-500 hover:bg-red-50 transition-colors"
        title="删除"
        @click.stop="emit('delete', message.id)"
      >
        <Trash2 class="w-3 h-3" />
      </button>
    </div>
    <div
      class="max-w-[84%] bg-brand text-white text-[13px] leading-relaxed px-3.5 py-2.5 rounded-2xl rounded-tr-sm shadow-sm whitespace-pre-wrap"
    >
      <div
        v-if="contextLabel"
        class="flex items-center gap-1 mb-1.5 pb-1.5 border-b border-white/20 text-[10px] text-white/80"
      >
        <Paperclip class="w-3 h-3 shrink-0" />
        <span class="truncate">{{ contextLabel }}</span>
      </div>
      {{ message.content }}
    </div>
  </div>

  <!-- AI message -->
  <div
    v-else
    class="flex flex-col gap-2 group"
    :class="isMultiModel ? 'max-w-full' : 'max-w-[95%]'"
    @mouseenter="isHovered = true"
    @mouseleave="isHovered = false"
  >
    <div class="flex items-center gap-1.5 text-[12px] font-medium text-zinc-900">
      <Sparkles class="w-3.5 h-3.5 text-brand" />
      <template v-if="modelName">
        <span
          class="text-[10px] px-1.5 py-0.5 rounded font-medium"
          :class="isMultiModel ? 'bg-brand/10 text-brand border border-brand/20' : 'text-zinc-400 font-normal'"
        >{{ modelName }}</span>
      </template>
      <span v-else class="text-[12px]">AuraMind</span>
      <span class="text-[10px] font-normal text-zinc-400">{{ statusLabel }}</span>
      <!-- Action buttons (appear on hover, right side of header) -->
      <div
        v-show="isHovered"
        class="flex items-center gap-0.5 ml-auto"
      >
        <button
          class="w-6 flex items-center justify-center rounded text-zinc-400 hover:text-brand hover:bg-brand/5 transition-colors"
          title="重新生成"
          @click.stop="emit('regenerate', message.id)"
        >
          <RefreshCw class="w-3 h-3" />
        </button>
        <button
          class="w-6 flex items-center justify-center rounded text-zinc-400 hover:text-brand hover:bg-brand/5 transition-colors"
          :title="copied ? '已复制!' : '复制为 Markdown'"
          @click.stop="handleCopyAsMarkdown"
        >
          <Clipboard v-if="copied" class="w-3 h-3 text-emerald-500" />
          <Copy v-else class="w-3 h-3" />
        </button>
        <button
          class="w-6 flex items-center justify-center rounded text-zinc-400 hover:text-brand hover:bg-brand/5 transition-colors"
          title="从此处分支"
          @click.stop="emit('branch', message.id)"
        >
          <GitBranch class="w-3 h-3" />
        </button>
        <button
          class="w-6 flex items-center justify-center rounded text-zinc-400 hover:text-brand hover:bg-brand/5 transition-colors"
          title="恢复到此处"
          @click.stop="emit('restore', message.id)"
        >
          <ChevronDown class="w-3 h-3 rotate-90" />
        </button>
        <button
          class="w-6 flex items-center justify-center rounded text-zinc-400 hover:text-red-500 hover:bg-red-50 transition-colors"
          title="删除"
          @click.stop="emit('delete', message.id)"
        >
          <Trash2 class="w-3 h-3" />
        </button>
      </div>
    </div>

    <div
      class="bg-white border rounded-2xl rounded-tl-sm px-3.5 py-3 text-[13px] leading-relaxed shadow-sm"
      :class="{
        'border-zinc-200 text-zinc-800': !isFailed && !isAborted,
        'border-red-300 text-red-800': isFailed,
        'border-zinc-200 text-zinc-500': isAborted,
      }"
    >
      <!-- Thinking / reasoning block (collapsible) -->
      <div
        v-if="message.reasoningContent"
        class="mb-2 border border-zinc-200 rounded-lg overflow-hidden"
      >
        <button
          class="w-full flex items-center gap-1 px-3 py-1.5 text-[11px] text-zinc-500 bg-zinc-50 hover:bg-zinc-100 transition-colors"
          @click="thinkingExpanded = !thinkingExpanded"
        >
          <ChevronRight v-if="!thinkingExpanded" class="w-3 h-3" />
          <ChevronDown v-else class="w-3 h-3" />
          思考过程
        </button>
        <div
          v-show="thinkingExpanded"
          class="px-3 py-2 text-[12px] text-zinc-600 leading-relaxed bg-zinc-50/50 border-t border-zinc-100 whitespace-pre-wrap"
        >
          {{ message.reasoningContent }}
        </div>
      </div>

      <!-- Rendered Markdown — also during streaming (with a cursor). Streaming
           re-renders throttled; highlight + copy-button are added on completion. -->
      <template v-if="!isFailed && !isAborted">
        <div
          ref="contentRef"
          class="md-render"
          v-html="displayedHtml"
        />
        <span v-if="isStreaming" class="inline-block w-1.5 h-4 bg-brand animate-pulse align-middle ml-0.5 rounded-sm" />
      </template>

      <!-- Failed state -->
      <template v-else-if="isFailed">
        <p v-if="message.content" class="mb-2 whitespace-pre-wrap">{{ message.content }}</p>
        <div class="text-red-600 text-[11px] bg-red-50 rounded-md p-2 border border-red-200">
          Error: {{ message.error || 'Unknown error' }}
        </div>
      </template>

      <!-- Aborted state -->
      <template v-else-if="isAborted">
        <p v-if="message.content && message.content !== '(stopped)'" class="whitespace-pre-wrap">{{ message.content }}</p>
        <div class="text-zinc-500 text-[11px] italic">
          已停止生成
        </div>
      </template>
    </div>
    <div v-if="meta" class="text-[10px] text-zinc-400 px-1 select-none">{{ meta }}</div>
  </div>
</template>
