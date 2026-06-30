<script lang="ts" setup>
import { computed, watch, ref, nextTick } from 'vue'
import { useDocumentStore } from '@/stores/document.store'
import { renderMarkdown, enhanceCodeBlocks } from '@/utils/markdown'

const documentStore = useDocumentStore()
const containerRef = ref<HTMLElement | null>(null)

const rawMarkdown = computed(() => documentStore.currentDocument?.markdown || '')

const renderedHtml = computed(() => renderMarkdown(rawMarkdown.value))

watch(renderedHtml, async () => {
  await nextTick()
  if (containerRef.value) enhanceCodeBlocks(containerRef.value)
})
</script>

<template>
  <div class="flex-1 overflow-y-auto p-5">
    <div
      v-if="rawMarkdown"
      ref="containerRef"
      class="md-render"
      v-html="renderedHtml"
    />
    <div v-else class="text-zinc-400 text-[13px] py-8 text-center">
      暂无 Markdown 内容
    </div>
  </div>
</template>
