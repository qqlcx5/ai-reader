<script lang="ts" setup>
import { computed, ref, watch, nextTick } from 'vue'
import { Sparkles, ChevronDown, ChevronRight } from '@lucide/vue'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import hljs from 'highlight.js'
import type { ChatMessage } from '@/types/chat'

const props = defineProps<{
  message: ChatMessage
  modelName?: string
}>()

const isUser = computed(() => props.message.role === 'user')
const isStreaming = computed(() => props.message.status === 'streaming')
const isFailed = computed(() => props.message.status === 'failed')
const isAborted = computed(() => props.message.status === 'aborted')

const thinkingExpanded = ref(false)
const contentRef = ref<HTMLElement | null>(null)

// Markdown rendering for completed assistant messages
const renderedHtml = computed(() => {
  if (isUser.value || isStreaming.value || isFailed.value || isAborted.value) return ''
  if (!props.message.content) return ''
  const raw = marked.parse(props.message.content, { async: false }) as string
  return DOMPurify.sanitize(raw)
})

function applyHighlight() {
  if (!contentRef.value) return
  const blocks = contentRef.value.querySelectorAll('pre code')
  blocks.forEach((block) => {
    hljs.highlightElement(block as HTMLElement)
  })
}

watch(renderedHtml, async () => {
  await nextTick()
  applyHighlight()
})
</script>

<template>
  <!-- User message -->
  <div v-if="isUser" class="flex justify-end">
    <div
      class="max-w-[84%] bg-brand text-white text-[13px] leading-relaxed px-3.5 py-2.5 rounded-2xl rounded-tr-sm shadow-sm whitespace-pre-wrap"
    >
      {{ message.content }}
    </div>
  </div>

  <!-- AI message -->
  <div v-else class="flex flex-col gap-2 max-w-[95%]">
    <div class="flex items-center gap-1.5 text-[12px] font-medium text-zinc-900">
      <Sparkles class="w-3.5 h-3.5 text-brand" />
      AuraMind
      <span v-if="modelName" class="text-[10px] text-zinc-400 font-normal">{{ modelName }}</span>
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
          class="prose prose-sm max-w-none prose-headings:text-zinc-900 prose-p:text-zinc-700 prose-a:text-brand prose-blockquote:border-l-brand prose-blockquote:text-zinc-600 prose-code:text-rose-600 prose-code:bg-zinc-100 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-[12px] prose-pre:bg-zinc-900 prose-pre:text-zinc-100 prose-table:border-collapse prose-th:border prose-th:border-zinc-300 prose-th:bg-zinc-50 prose-th:px-3 prose-th:py-2 prose-td:border prose-td:border-zinc-200 prose-td:px-3 prose-td:py-2 prose-li:text-zinc-700 prose-strong:text-zinc-900"
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
  </div>
</template>
