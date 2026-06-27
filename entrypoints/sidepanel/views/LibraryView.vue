<script setup lang="ts">
import { Search, Database } from '@lucide/vue'
import { usePopupStore } from '@/stores/popup'
import { useLibraryStore } from '@/stores/library'
import { useArticles } from '../composables/useArticles'
import AppCard from '../components/AppCard.vue'

const popup = usePopupStore()
const library = useLibraryStore()
const { searchQuery, groupedByDate, setSearchQuery } = useArticles()

function openArticle(id: string) {
  library.selectArticle(id)
  popup.setView('reader')
}
</script>

<template>
  <div class="p-4">
    <div class="relative mb-4">
      <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
      <input
        :value="searchQuery"
        type="text"
        role="searchbox"
        aria-label="搜索文章"
        placeholder="搜索文章..."
        class="w-full pl-9 pr-3 py-2 text-sm rounded-12px border border-gray-200 bg-white outline-none focus:border-blue/40 transition-colors"
        @input="setSearchQuery(($event.target as HTMLInputElement).value)"
      />
    </div>

    <div v-if="groupedByDate.length > 0" class="space-y-4">
      <div v-for="group in groupedByDate" :key="group.label">
        <h3 class="text-11px font-semibold text-gray-400 uppercase tracking-wide mb-2">{{ group.label }}</h3>
        <div class="space-y-2">
          <AppCard v-for="article in group.articles" :key="article.id" @click="openArticle(article.id)">
            <div class="flex items-start gap-3">
              <img v-if="article.faviconUrl" :src="article.faviconUrl" class="w-6 h-6 rounded mt-0.5 flex-shrink-0" alt="" />
              <div class="flex-1 min-w-0">
                <h4 class="text-sm font-medium text-text truncate">{{ article.title }}</h4>
                <p class="text-10px text-gray-400 mt-1 truncate">{{ article.siteName }}</p>
                <p v-if="article.excerpt" class="text-11px text-gray-500 mt-1 line-clamp-2">{{ article.excerpt }}</p>
              </div>
            </div>
          </AppCard>
        </div>
      </div>
    </div>

    <div v-else class="text-center py-12 text-gray-400">
      <Database class="w-10 h-10 mx-auto mb-3 opacity-40" />
      <p class="text-sm font-medium">暂无保存的文章</p>
      <p class="text-11px mt-1">剪藏网页后，文章将显示在这里</p>
    </div>
  </div>
</template>
