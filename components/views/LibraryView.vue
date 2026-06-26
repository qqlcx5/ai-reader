<script lang="ts" setup>
import { ref, computed } from 'vue'
import SectionHead from '../common/SectionHead.vue'
import ArticleItem from '../common/ArticleItem.vue'
import type { Article } from '../types'

const props = defineProps<{
  articles: Article[]
}>()

const emit = defineEmits<{
  openReader: [articleId: string]
  showToast: [title: string, desc: string]
}>()

const keyword = ref('')

const filtered = computed(() => {
  const q = keyword.value.trim().toLowerCase()
  if (!q) return props.articles
  return props.articles.filter(a =>
    [a.title, a.siteName, a.author, a.url, a.excerpt, a.markdown]
      .join(' ').toLowerCase().includes(q),
  )
})
</script>

<template>
  <section class="h-full overflow-auto pb-3.5">
    <!-- Search -->
    <div
      class="p-3 rounded-22px"
      style="border: 1px solid rgba(29,29,31,0.08); background: rgba(255,255,255,0.78); backdrop-filter: blur(24px)"
    >
      <SectionHead title="Library" action="清空搜索" @action="keyword = ''; emit('showToast', '搜索已清空', '已显示全部本地文章')" />

      <div
        class="h-38px rounded-14px border border-rgba(29,29,31,0.08) bg-white/72 flex items-center gap-2 px-3 text-#a1a1aa"
      >
        <span>⌕</span>
        <input
          v-model="keyword"
          class="w-full border-0 outline-none bg-transparent text-#1d1d1f text-13px"
          placeholder="搜索标题、作者、站点或 Markdown..."
        >
      </div>

      <div class="mt-2.5 flex flex-wrap gap-2">
        <span class="h-25px px-2.5 rounded-full inline-flex items-center border border-rgba(29,29,31,0.08) bg-white/68 text-#52525b text-11px">
          {{ articles.length }} 篇文章
        </span>
        <span class="h-25px px-2.5 rounded-full inline-flex items-center border border-rgba(29,29,31,0.08) bg-white/68 text-#52525b text-11px">
          IndexedDB
        </span>
        <span class="h-25px px-2.5 rounded-full inline-flex items-center border border-rgba(29,29,31,0.08) bg-white/68 text-#52525b text-11px">
          {{ keyword ? `搜索：${keyword}` : '本地优先' }}
        </span>
      </div>
    </div>

    <!-- Article List -->
    <div
      class="mt-3 p-2.5 rounded-20px"
      style="border: 1px solid rgba(29,29,31,0.08); background: rgba(255,255,255,0.78); backdrop-filter: blur(24px); box-shadow: inset 0 1px 0 rgba(255,255,255,0.72), 0 1px 2px rgba(0,0,0,0.04)"
    >
      <div v-if="filtered.length === 0" class="px-4 py-7 text-center text-#6e6e73">
        <div class="text-14px font-bold text-#27272a">没有匹配文章</div>
        <div class="mt-1.5 text-12px">换个关键词，或回到采集页保存当前网页。</div>
      </div>
      <div v-else class="flex flex-col gap-2">
        <ArticleItem
          v-for="article in filtered"
          :key="article.id"
          :article="article"
          @select="emit('openReader', article.id)"
          @delete="emit('showToast', '已删除', article.title)"
        />
      </div>
    </div>
  </section>
</template>
