<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Search, Calendar, Globe, Cpu, Quote, Sparkles } from '@lucide/vue'
import { useLibraryStore } from '@/stores/library'
import { useArticles } from '../composables/useArticles'
import type { SavedArticle } from '@/shared/domain'
import { usePopupStore } from '@/stores/popup'

const library = useLibraryStore()
const popup = usePopupStore()

const searchQuery = ref('')
const activeTag = ref('全部')

const { articles, isLoading } = useArticles()

const tags = ['全部', '#AI', '#知识管理', '#Obsidian']

const filteredArticles = computed(() => {
  let list = library.articles
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    list = list.filter(a =>
      a.title.toLowerCase().includes(q) ||
      a.excerpt?.toLowerCase().includes(q) ||
      a.siteName.toLowerCase().includes(q)
    )
  }
  if (activeTag.value !== '全部') {
    list = list.filter(a =>
      a.markdown?.includes(activeTag.value) ||
      a.excerpt?.includes(activeTag.value)
    )
  }
  return list
})

function openDetail(article: SavedArticle) {
  library.selectArticle(article.id)
}

function getRelativeTime(article: SavedArticle): string {
  const now = Date.now()
  const created = new Date(article.createdAt).getTime()
  const diff = now - created
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}分钟前`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}小时前`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}天前`
  return `${Math.floor(days / 7)}周前`
}

function getDomainIcon(article: SavedArticle) {
  if (article.siteName?.includes('github')) return 'code'
  if (article.siteName?.includes('fortelabs')) return 'globe'
  return 'globe'
}
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- 3.1 Search toolbar -->
    <div class="p-4 border-b border-gray-100 space-y-2 flex-shrink-0 bg-gray-50">
      <div class="relative bg-white border border-gray-200 rounded-xl flex items-center px-3 shadow-sm focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500">
        <Search class="w-4 h-4 text-gray-400 mr-2 flex-shrink-0" />
        <input
          v-model="searchQuery"
          type="text"
          class="w-full text-xs py-2 bg-transparent outline-none placeholder-gray-400"
          placeholder="检索标题、摘要、全文、或标签..."
        >
      </div>
      <!-- Quick tag filter -->
      <div class="flex items-center space-x-1.5 overflow-x-auto no-scrollbar py-1">
        <button
          v-for="tag in tags"
          :key="tag"
          class="flex-shrink-0 px-2 py-0.5 text-10px font-medium rounded-md cursor-pointer transition border-0"
          :class="activeTag === tag
            ? 'bg-blue-50 text-blue-600 border border-blue-100 font-semibold'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'"
          @click="activeTag = tag"
        >
          {{ tag }}
        </button>
      </div>
    </div>

    <!-- 3.2 Timeline cards -->
    <div class="flex-grow overflow-y-auto p-4 space-y-4 no-scrollbar max-h-460px">
      <!-- Loading state -->
      <div v-if="isLoading" class="flex items-center justify-center py-8 text-gray-400 text-xs">
        加载中...
      </div>

      <!-- Empty state -->
      <div v-if="!isLoading && filteredArticles.length === 0 && library.articles.length === 0" class="flex flex-col items-center justify-center py-8 text-gray-400 space-y-2">
        <span class="text-xs">剪藏的网页文章将展示于此</span>
        <span class="text-10px">切换到「当前网页」标签开始剪藏</span>
      </div>

      <div v-if="!isLoading && searchQuery && filteredArticles.length === 0" class="flex flex-col items-center justify-center py-8 text-gray-400 space-y-2">
        <span class="text-xs">未找到匹配结果</span>
        <span class="text-10px">试试其他关键词</span>
      </div>

      <!-- Timeline groups -->
      <template v-for="(group, gIdx) in [
        { label: '今天 (Today)', articles: filteredArticles.filter(a => getRelativeTime(a).includes('分钟') || getRelativeTime(a).includes('小时') || getRelativeTime(a) === '0分钟前') },
        { label: '本周 (This Week)', articles: filteredArticles.filter(a => {
          const rel = getRelativeTime(a)
          return rel.includes('天') && !rel.includes('周') && parseInt(rel) <= 7
        })},
        { label: '更早 (Earlier)', articles: filteredArticles.filter(a => {
          const rel = getRelativeTime(a)
          return rel.includes('周') || (rel.includes('天') && parseInt(rel) > 7)
        })},
      ]" :key="gIdx">
        <div v-if="group.articles.length > 0" class="space-y-2">
          <div class="text-10px font-bold text-gray-400 uppercase tracking-wider flex items-center">
            <Calendar class="w-3 h-3 mr-1" /> {{ group.label }}
          </div>

          <div
            v-for="article in group.articles"
            :key="article.id"
            class="bg-white border border-gray-200 p-3 rounded-xl hover:shadow-md hover:border-blue-400 transition cursor-pointer space-y-2 history-card"
            @click="openDetail(article)"
          >
            <div class="flex items-start justify-between">
              <div class="flex items-center space-x-2">
                <div
                  class="w-4 h-4 rounded flex items-center justify-center flex-shrink-0"
                  :class="article.siteName?.includes('github') ? 'bg-red-50' : 'bg-blue-50'"
                >
                  <Globe
                    v-if="!article.siteName?.includes('github')"
                    class="w-2.5 h-2.5 text-blue-500"
                  />
                  <Cpu
                    v-else
                    class="w-2.5 h-2.5 text-red-500"
                  />
                </div>
                <span class="text-10px text-gray-400 font-medium truncate max-w-150px">{{ article.siteName }}</span>
              </div>
              <span class="text-10px text-gray-400">{{ getRelativeTime(article) }}</span>
            </div>
            <h4 class="text-xs font-bold text-gray-900 leading-tight">{{ article.title }}</h4>
            <p class="text-11px text-gray-500 line-clamp-2">{{ article.excerpt }}</p>
            <div class="flex items-center justify-between pt-1 border-t border-gray-50">
              <div class="flex space-x-1">
                <span class="px-1.5 py-0.2 bg-blue-50 text-blue-600 rounded text-9px font-medium">#PKM</span>
                <span class="px-1.5 py-0.2 bg-purple-50 text-purple-600 rounded text-9px font-medium">#AI总结</span>
              </div>
              <div class="flex space-x-1">
                <Quote class="w-3 h-3 text-amber-500" title="包含划词高亮" />
                <Sparkles class="w-3 h-3 text-blue-500" title="已进行AI消化" />
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
