<script lang="ts" setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useArticleStore } from '@/stores/article.store'
import { AppError } from '@/domain'
import type { ToastType } from '@/domain'
import SectionHead from '../common/SectionHead.vue'
import ArticleItem from '../common/ArticleItem.vue'

function useDebounceFn<T extends (...args: any[]) => void>(fn: T, delay: number) {
  let timer: ReturnType<typeof setTimeout> | null = null
  return (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => fn(...args), delay)
  }
}

const emit = defineEmits<{
  openReader: [articleId: string]
  showToast: [arg: string | ToastType, desc?: string]
  confirmDelete: [articleId: string]
}>()

const articleStore = useArticleStore()
const keyword = ref('')
const debouncedKeyword = ref('')

const sortedArticles = computed(() =>
  [...articleStore.articles].sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  ),
)

const updateDebounced = useDebounceFn((value: string) => {
  debouncedKeyword.value = value
}, 300)

watch(keyword, (value) => {
  updateDebounced(value)
})

const filtered = computed(() => {
  const q = debouncedKeyword.value.trim().toLowerCase()
  if (!q) return sortedArticles.value
  return sortedArticles.value.filter((a) => {
    const fields = [a.title, a.siteName ?? '', a.author ?? '', a.excerpt ?? '']
    return fields.some((f) => f.toLowerCase().includes(q))
  })
})

const isSearchEmpty = computed(() =>
  debouncedKeyword.value.trim().length > 0 && filtered.value.length === 0,
)

const isLibraryEmpty = computed(() =>
  articleStore.articles.length === 0 && !debouncedKeyword.value.trim(),
)

function clearSearch() {
  keyword.value = ''
  debouncedKeyword.value = ''
  emit('showToast', { type: 'success', title: '搜索已清空', description: '已显示全部本地文章' })
}

function onOpenArticle(id: string) {
  articleStore.setActiveArticle(id)
  emit('openReader', id)
}

function onDeleteRequest(id: string) {
  emit('confirmDelete', id)
}

onMounted(() => {
  articleStore.loadArticles().catch((e) => {
    const message = e instanceof Error ? e.message : '加载文章失败'
    throw new AppError('INDEXEDDB_FAILED', message, e instanceof Error ? e : undefined)
  })
})
</script>

<template>
  <section class="h-full overflow-auto pb-3.5">
    <!-- Search -->
    <div
      class="p-3 rounded-22px"
      style="border: 1px solid rgba(29,29,31,0.08); background: rgba(255,255,255,0.78); backdrop-filter: blur(24px)"
    >
      <SectionHead title="Library" action="清空搜索" @action="clearSearch" />

      <div
        class="h-38px rounded-14px border border-rgba(29,29,31,0.08) bg-white/72 flex items-center gap-2 px-3 text-#a1a1aa"
      >
        <span>⌕</span>
        <input
          v-model="keyword"
          class="w-full border-0 outline-none bg-transparent text-#1d1d1f text-13px"
          placeholder="搜索标题、作者、站点..."
        >
      </div>

      <div class="mt-2.5 flex flex-wrap gap-2">
        <span class="h-25px px-2.5 rounded-full inline-flex items-center border border-rgba(29,29,31,0.08) bg-white/68 text-#52525b text-11px">
          {{ articleStore.articles.length }} 篇文章
        </span>
        <span class="h-25px px-2.5 rounded-full inline-flex items-center border border-rgba(29,29,31,0.08) bg-white/68 text-#52525b text-11px">
          IndexedDB
        </span>
        <span class="h-25px px-2.5 rounded-full inline-flex items-center border border-rgba(29,29,31,0.08) bg-white/68 text-#52525b text-11px">
          {{ debouncedKeyword ? `搜索：${debouncedKeyword}` : '本地优先' }}
        </span>
      </div>
    </div>

    <!-- Article List -->
    <div
      class="mt-3 p-2.5 rounded-20px"
      style="border: 1px solid rgba(29,29,31,0.08); background: rgba(255,255,255,0.78); backdrop-filter: blur(24px); box-shadow: inset 0 1px 0 rgba(255,255,255,0.72), 0 1px 2px rgba(0,0,0,0.04)"
    >
      <div v-if="isLibraryEmpty" class="px-4 py-7 text-center text-#6e6e73">
        <div class="text-14px font-bold text-#27272a">暂无保存文章</div>
        <div class="mt-1.5 text-12px">回到采集页保存当前网页。</div>
      </div>
      <div v-else-if="isSearchEmpty" class="px-4 py-7 text-center text-#6e6e73">
        <div class="text-14px font-bold text-#27272a">没有匹配文章</div>
        <div class="mt-1.5 text-12px">换个关键词，或回到采集页保存当前网页。</div>
      </div>
      <div v-else class="flex flex-col gap-2">
        <ArticleItem
          v-for="article in filtered"
          :key="article.id"
          :article="article"
          @select="onOpenArticle(article.id)"
          @delete="onDeleteRequest(article.id)"
        />
      </div>
    </div>
  </section>
</template>
