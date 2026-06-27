<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ArrowLeft, FileDown, Trash2, X } from '@lucide/vue'
import { useLibraryStore } from '@/stores/library'
import { useModal } from '../composables/useModal'
import { useToast } from '../composables/useToast'
import { articleRepo } from '@/db/article.repository'
import { exportArticleObsidian, downloadFile } from '@/core/export/obsidian-exporter'

const library = useLibraryStore()
const modal = useModal()
const toast = useToast()

const isOpen = ref(false)
const article = computed(() => library.selectedArticle)

// Auto-open when library selects an article
watch(() => library.selectedId, (newId) => {
  if (newId) {
    isOpen.value = true
  } else {
    isOpen.value = false
  }
})

function open(id: string) {
  library.selectArticle(id)
}

function close() {
  isOpen.value = false
  library.selectArticle(null)
}

async function handleDelete() {
  if (!article.value) return
  const confirmed = await modal.open({
    title: '确认删除',
    description: `将删除「${article.value.title}」，此操作不可撤销。`,
    confirmLabel: '删除',
    variant: 'danger',
  })
  if (confirmed) {
    await articleRepo.delete(article.value.id)
    library.removeArticle(article.value.id)
    toast.showInfo('已删除', article.value.title)
    close()
  }
}

function exportObsidian() {
  if (!article.value) return
  const result = exportArticleObsidian(article.value)
  downloadFile(result.filename, result.content)
  toast.showSuccess('已导出', result.filename)
}

defineExpose({ open, close, isOpen })
</script>

<template>
  <Teleport to="body">
    <div
      v-if="isOpen && article"
      class="absolute inset-0 bg-white z-50 transform transition-transform duration-300 flex flex-col"
      :class="isOpen ? 'translate-x-0' : 'translate-x-full'"
    >
      <div class="flex-grow overflow-y-auto no-scrollbar p-4 space-y-4">
        <!-- Header -->
        <div class="flex items-center justify-between border-b border-gray-100 pb-3">
          <button
            class="flex items-center space-x-1 text-gray-400 hover:text-gray-600 bg-transparent border-0 cursor-pointer text-xs"
            @click="close"
          >
            <ArrowLeft class="w-4 h-4" />
            <span>返回列表</span>
          </button>
          <span class="text-10px text-gray-400 font-mono">ID: {{ article.id.slice(0, 8) }}</span>
          <button
            class="text-gray-400 hover:text-red-500 transition bg-transparent border-0 cursor-pointer p-0"
            aria-label="删除文章"
            @click="handleDelete"
          >
            <Trash2 class="w-4 h-4" />
          </button>
        </div>

        <!-- Title -->
        <h2 class="text-sm font-bold text-gray-900 leading-snug">{{ article.title }}</h2>

        <!-- YAML Frontmatter -->
        <div class="bg-gray-950 text-green-400 p-3 rounded-xl font-mono text-10px overflow-x-auto space-y-1">
          <div>---</div>
          <div>title: "{{ article.title }}"</div>
          <div>url: "{{ article.url }}"</div>
          <div v-if="article.author">author: "{{ article.author }}"</div>
          <div>clipped_at: "{{ article.createdAt }}"</div>
          <div v-if="article.siteName">site: "{{ article.siteName }}"</div>
          <div>---</div>
        </div>

        <!-- Markdown content -->
        <div class="space-y-2">
          <span class="text-xs font-bold text-gray-400 block tracking-wider uppercase">Obsidian Markdown 正文段落</span>
          <article class="prose prose-sm text-xs text-gray-600 leading-relaxed space-y-2 max-w-none">
            <pre class="whitespace-pre-wrap text-11px text-gray-600 font-mono bg-gray-50 p-3 rounded-lg overflow-x-auto"><code>{{ article.markdown }}</code></pre>
          </article>
        </div>
      </div>

      <!-- Bottom actions -->
      <div class="p-4 border-t border-gray-100 bg-gray-50 flex space-x-2">
        <button
          class="flex-grow bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-xl text-xs transition flex items-center justify-center space-x-1.5 border-0 cursor-pointer"
          @click="exportObsidian"
        >
          <FileDown class="w-4 h-4" />
          <span>导出 Obsidian Markdown 文件</span>
        </button>
        <button
          class="bg-gray-200 hover:bg-gray-300 text-gray-700 py-2 px-3 rounded-xl text-xs transition border-0 cursor-pointer"
          @click="close"
        >
          关闭
        </button>
      </div>
    </div>
  </Teleport>
</template>
