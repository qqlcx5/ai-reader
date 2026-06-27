<script lang="ts" setup>
import { computed } from 'vue'
import { useDocumentStore } from '@/stores/document.store'

const documentStore = useDocumentStore()

const rawContent = computed(() => {
  return documentStore.currentDocument?.rawText
    || documentStore.currentDocument?.markdown
    || ''
})
</script>

<template>
  <div class="flex-1 overflow-y-auto bg-gray-900 p-4">
    <pre
      v-if="rawContent"
      class="text-[12px] leading-relaxed text-zinc-300 font-mono whitespace-pre-wrap break-words"
    ><code>{{ rawContent }}</code></pre>
    <div v-else class="text-zinc-500 text-[13px] py-8 text-center">
      暂无原始内容
    </div>
  </div>
</template>
