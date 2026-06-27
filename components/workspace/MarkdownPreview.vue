<script lang="ts" setup>
import { computed, watch, ref, nextTick } from 'vue'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import hljs from 'highlight.js'
import { useDocumentStore } from '@/stores/document.store'

const documentStore = useDocumentStore()
const containerRef = ref<HTMLElement | null>(null)

const rawMarkdown = computed(() => {
  return documentStore.currentDocument?.markdown || ''
})

const renderedHtml = computed(() => {
  if (!rawMarkdown.value) return ''
  const rawHtml = marked.parse(rawMarkdown.value, { async: false }) as string
  return DOMPurify.sanitize(rawHtml)
})

function applyHighlight() {
  if (!containerRef.value) return
  const codeBlocks = containerRef.value.querySelectorAll('pre code')
  codeBlocks.forEach((block) => {
    hljs.highlightElement(block as HTMLElement)
  })
}

watch(renderedHtml, async () => {
  await nextTick()
  applyHighlight()
})
</script>

<template>
  <div class="flex-1 overflow-y-auto p-5">
    <div
      v-if="rawMarkdown"
      ref="containerRef"
      class="prose prose-sm max-w-none prose-headings:text-zinc-900 prose-p:text-zinc-700 prose-a:text-brand prose-blockquote:border-l-brand prose-blockquote:text-zinc-600 prose-code:text-brand prose-code:bg-zinc-100 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:bg-zinc-900 prose-pre:text-zinc-100 prose-table:border-collapse prose-th:border prose-th:border-zinc-300 prose-th:bg-zinc-50 prose-th:px-3 prose-th:py-2 prose-td:border prose-td:border-zinc-200 prose-td:px-3 prose-td:py-2"
      v-html="renderedHtml"
    />
    <div v-else class="text-zinc-400 text-[13px] py-8 text-center">
      暂无 Markdown 内容
    </div>
  </div>
</template>
