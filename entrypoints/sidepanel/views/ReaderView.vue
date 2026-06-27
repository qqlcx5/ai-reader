<script setup lang="ts">
import { computed, ref } from 'vue'
import { ArrowLeft, Copy, Trash2, Check } from '@lucide/vue'
import { usePopupStore } from '@/stores/popup'
import { useLibraryStore } from '@/stores/library'
import { useModal } from '../composables/useModal'
import { useToast } from '../composables/useToast'
import IconButton from '../components/IconButton.vue'

const popup = usePopupStore()
const library = useLibraryStore()
const modal = useModal()
const toast = useToast()

const article = computed(() => library.selectedArticle)
const copied = ref(false)

async function handleCopy() {
  if (!article.value) return
  try {
    await navigator.clipboard.writeText(article.value.markdown)
    copied.value = true
    toast.showSuccess('已复制到剪贴板')
    setTimeout(() => (copied.value = false), 2000)
  } catch {
    toast.showError('复制失败', '请检查剪贴板权限')
  }
}

async function handleDelete() {
  const confirmed = await modal.open({
    title: '确认删除',
    description: `将删除「${article.value?.title ?? '这篇文章'}」，此操作不可撤销。`,
    confirmLabel: '删除',
    variant: 'danger',
  })
  if (confirmed && article.value) {
    library.removeArticle(article.value.id)
    toast.showInfo('已删除', article.value.title)
    popup.goBack()
  }
}

function exportObsidian() {
  if (!article.value) return
  const md = article.value.markdown
  const blob = new Blob([md], { type: 'text/markdown' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${article.value.title.replace(/[/\\?%*:|"<>]/g, '_')}.md`
  a.click()
  URL.revokeObjectURL(url)
  toast.showSuccess('已导出')
}
</script>

<template>
  <div v-if="article" class="flex flex-col h-full">
    <div class="flex items-center gap-2 px-4 py-3 border-b border-gray-200/60">
      <IconButton aria-label="返回" @click="popup.goBack()">
        <ArrowLeft class="w-4 h-4" />
      </IconButton>
      <h2 class="text-sm font-semibold text-text truncate flex-1">{{ article.title }}</h2>
      <IconButton aria-label="复制 Markdown" @click="handleCopy">
        <Check v-if="copied" class="w-4 h-4 text-green-500" />
        <Copy v-else class="w-4 h-4" />
      </IconButton>
      <IconButton aria-label="删除文章" @click="handleDelete">
        <Trash2 class="w-4 h-4 text-red-400" />
      </IconButton>
    </div>

    <div class="flex-1 overflow-y-auto no-scrollbar p-4 space-y-4">
      <div class="grid grid-cols-2 gap-3">
        <div v-if="article.url" class="col-span-2">
          <p class="text-10px text-gray-400">来源</p>
          <a :href="article.url" target="_blank" class="text-11px text-blue break-all hover:underline">{{ article.url }}</a>
        </div>
        <div v-if="article.author">
          <p class="text-10px text-gray-400">作者</p>
          <p class="text-11px text-text">{{ article.author }}</p>
        </div>
        <div v-if="article.publishedAt">
          <p class="text-10px text-gray-400">发布日期</p>
          <p class="text-11px text-text">{{ article.publishedAt }}</p>
        </div>
        <div v-if="article.readingTime">
          <p class="text-10px text-gray-400">阅读时长</p>
          <p class="text-11px text-text">{{ article.readingTime }} 分钟</p>
        </div>
        <div v-if="article.siteName">
          <p class="text-10px text-gray-400">站点</p>
          <p class="text-11px text-text">{{ article.siteName }}</p>
        </div>
      </div>

      <button
        class="w-full py-2 text-xs rounded-12px bg-gray-100 text-text hover:bg-gray-200 transition-colors border-0 cursor-pointer"
        aria-label="导出 Obsidian Markdown"
        @click="exportObsidian"
      >
        导出 Obsidian Markdown
      </button>

      <details class="text-10px text-gray-400">
        <summary class="cursor-pointer font-medium">Frontmatter</summary>
        <pre class="mt-2 p-2 bg-gray-50 rounded-lg overflow-x-auto text-10px"><code>{{ article.markdown.split('\n').slice(0, 20).join('\n') }}</code></pre>
      </details>

      <div class="prose prose-sm max-w-none text-sm text-text leading-relaxed">
        <pre class="whitespace-pre-wrap text-11px text-gray-600 font-mono bg-gray-50 p-3 rounded-lg overflow-x-auto"><code>{{ article.markdown }}</code></pre>
      </div>
    </div>
  </div>

  <div v-else class="flex items-center justify-center h-full text-gray-400 text-xs">未选择文章</div>
</template>
