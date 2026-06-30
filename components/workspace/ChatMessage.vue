<script lang="ts" setup>
import { computed, ref, watch, nextTick } from 'vue'
import { Sparkles, ChevronDown, ChevronRight, RefreshCw, Copy, Trash2, Pencil } from '@lucide/vue'
import { renderMarkdown, enhanceCodeBlocks } from '@/utils/markdown'
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
}>()

const emit = defineEmits<{
  (e: 'regenerate', id: string): void
  (e: 'copy', content: string): void
  (e: 'delete', id: string): void
  (e: 'edit', id: string, content: string): void
}>()

const isUser = computed(() => props.message.role === 'user')
const isStreaming = computed(() => props.message.status === 'streaming')
const isFailed = computed(() => props.message.status === 'failed')
const isAborted = computed(() => props.message.status === 'aborted')

const isHovered = ref(false)
const thinkingExpanded = ref(false)
const contentRef = ref<HTMLElement | null>(null)

// Markdown rendering for completed assistant messages
const renderedHtml = computed(() => {
  if (isUser.value || isStreaming.value || isFailed.value || isAborted.value) return ''
  return renderMarkdown(props.message.content || '')
})

watch(renderedHtml, async () => {
  await nextTick()
  if (contentRef.value) enhanceCodeBlocks(contentRef.value)
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
        class="w-6 h-6 flex items-center justify-center rounded text-zinc-400 hover:text-brand hover:bg-brand/5 transition-colors"
        title="编辑"
        @click.stop="emit('edit', message.id, message.content)"
      >
        <Pencil class="w-3 h-3" />
      </button>
      <button
        class="w-6 h-6 flex items-center justify-center rounded text-zinc-400 hover:text-brand hover:bg-brand/5 transition-colors"
        title="复制"
        @click.stop="emit('copy', message.content)"
      >
        <Copy class="w-3 h-3" />
      </button>
      <button
        class="w-6 h-6 flex items-center justify-center rounded text-zinc-400 hover:text-red-500 hover:bg-red-50 transition-colors"
        title="删除"
        @click.stop="emit('delete', message.id)"
      >
        <Trash2 class="w-3 h-3" />
      </button>
    </div>
    <div
      class="max-w-[84%] bg-brand text-white text-[13px] leading-relaxed px-3.5 py-2.5 rounded-2xl rounded-tr-sm shadow-sm whitespace-pre-wrap"
    >
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
      <!-- Action buttons (appear on hover, right side of header) -->
      <div
        v-show="isHovered"
        class="flex items-center gap-0.5 ml-auto"
      >
        <button
          class="w-6 h-6 flex items-center justify-center rounded text-zinc-400 hover:text-brand hover:bg-brand/5 transition-colors"
          title="重新生成"
          @click.stop="emit('regenerate', message.id)"
        >
          <RefreshCw class="w-3 h-3" />
        </button>
        <button
          class="w-6 h-6 flex items-center justify-center rounded text-zinc-400 hover:text-brand hover:bg-brand/5 transition-colors"
          title="复制"
          @click.stop="emit('copy', message.content)"
        >
          <Copy class="w-3 h-3" />
        </button>
        <button
          class="w-6 h-6 flex items-center justify-center rounded text-zinc-400 hover:text-red-500 hover:bg-red-50 transition-colors"
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

      <!-- Normal content (rendered Markdown) -->
      <template v-if="!isFailed && !isAborted && !isStreaming">
        <div
          ref="contentRef"
          class="md-render"
          v-html="renderedHtml"
        />
      </template>

      <!-- Streaming content with cursor -->
      <template v-else-if="isStreaming">
        <span class="whitespace-pre-wrap">{{ message.content }}</span>
        <span class="inline-block w-1.5 h-4 bg-brand animate-pulse align-middle ml-0.5 rounded-sm" />
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
