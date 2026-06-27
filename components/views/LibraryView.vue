<script lang="ts" setup>
import { ref, computed } from 'vue'
import {
  DialogRoot, DialogPortal, DialogOverlay, DialogContent,
  DialogTitle, DialogDescription, DialogClose,
  ToggleGroupRoot, ToggleGroupItem,
} from 'reka-ui'
import type { Article } from '../types'

const props = defineProps<{
  articles: Article[]
}>()

const emit = defineEmits<{
  showToast: [title: string, desc: string]
}>()

const keyword = ref('')
const activeTag = ref<string | null>(null)
const selectedArticle = ref<Article | null>(null)
const dialogOpen = ref(false)

const allTags = computed(() => {
  const tagSet = new Set<string>()
  props.articles.forEach(a => a.tags?.forEach(t => tagSet.add(t)))
  return Array.from(tagSet)
})

const filtered = computed(() => {
  let list = props.articles
  if (activeTag.value) {
    list = list.filter(a => a.tags?.includes(activeTag.value!))
  }
  const q = keyword.value.trim().toLowerCase()
  if (q) {
    list = list.filter(a =>
      [a.title, a.siteName, a.author, a.url, a.excerpt, a.markdown]
        .join(' ').toLowerCase().includes(q),
    )
  }
  return list
})

const todayArticles = computed(() => filtered.value.filter(a => a.createdAt.includes('刚刚') || a.createdAt.includes('分钟') || a.createdAt === '今天'))
const earlierArticles = computed(() => filtered.value.filter(a => !todayArticles.value.includes(a)))

function toggleTag(tag: string) {
  activeTag.value = activeTag.value === tag ? null : tag
}

function openDetail(article: Article) {
  selectedArticle.value = article
  dialogOpen.value = true
}

function closeDetail() {
  dialogOpen.value = false
  setTimeout(() => { selectedArticle.value = null }, 200)
}

function exportSingleObsidian() {
  emit('showToast', '已导出 Obsidian Markdown', '正文底部已融合 AI TL;DR 消化分析')
  closeDetail()
}
</script>

<template>
  <section class="flex flex-col h-full">
    <!-- 检索工具栏 -->
    <div class="p-4 border-b border-gray-100 space-y-2 flex-shrink-0 bg-gray-50">
      <div class="relative bg-white border border-gray-200 rounded-xl flex items-center px-3 shadow-sm focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500">
        <svg class="w-4 h-4 text-gray-400 mr-2 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
        <input
          v-model="keyword"
          type="text"
          class="w-full text-xs py-2 bg-transparent outline-none placeholder-gray-400"
          placeholder="检索标题、摘要、全文、或标签..."
        >
      </div>
      <!-- 快捷标签过滤器 -->
      <ToggleGroupRoot
        v-model="activeTag"
        type="single"
        class="flex items-center space-x-1.5 overflow-x-auto py-1"
        style="scrollbar-width: none"
      >
        <ToggleGroupItem
          value=""
          class="flex-shrink-0 px-2 py-0.5 text-[10px] font-semibold rounded-md cursor-pointer border bg-transparent data-[state=on]:bg-blue-50 data-[state=on]:text-blue-600 data-[state=on]:border-blue-100 bg-gray-100 text-gray-600 border-transparent hover:bg-gray-200"
          @click="activeTag = null"
        >
          全部
        </ToggleGroupItem>
        <ToggleGroupItem
          v-for="tag in allTags"
          :key="tag"
          :value="tag"
          class="flex-shrink-0 px-2 py-0.5 text-[10px] font-medium rounded-md cursor-pointer border bg-transparent data-[state=on]:bg-blue-50 data-[state=on]:text-blue-600 data-[state=on]:border-blue-100 bg-gray-100 text-gray-600 border-transparent hover:bg-gray-200"
        >
          #{{ tag }}
        </ToggleGroupItem>
      </ToggleGroupRoot>
    </div>

    <!-- 时间轴列表 -->
    <div class="flex-grow overflow-y-auto p-4 space-y-4" style="scrollbar-width: none">
      <!-- 今天 -->
      <div v-if="todayArticles.length" class="space-y-2">
        <div class="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center">
          <svg class="w-3 h-3 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          今天 (Today)
        </div>
        <div
          v-for="article in todayArticles"
          :key="article.id"
          class="bg-white border border-gray-200 p-3 rounded-xl hover:shadow-md hover:border-blue-400 transition cursor-pointer space-y-2"
          @click="openDetail(article)"
        >
          <div class="flex items-start justify-between">
            <div class="flex items-center space-x-2">
              <div class="w-4 h-4 rounded bg-blue-50 flex items-center justify-center flex-shrink-0">
                <svg class="w-2.5 h-2.5 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
              </div>
              <span class="text-[10px] text-gray-400 font-medium truncate max-w-[150px]">{{ article.siteName }}</span>
            </div>
            <span class="text-[10px] text-gray-400">{{ article.createdAt }}</span>
          </div>
          <div class="text-xs font-bold text-gray-900 leading-tight">{{ article.title }}</div>
          <p class="text-[11px] text-gray-500 line-clamp-2">{{ article.excerpt }}</p>
          <div class="flex items-center justify-between pt-1 border-t border-gray-50">
            <div class="flex space-x-1">
              <span
                v-for="tag in article.tags?.slice(0, 2)"
                :key="tag"
                class="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded text-[9px] font-medium"
              >#{{ tag }}</span>
            </div>
            <div class="flex space-x-1">
              <svg class="w-3 h-3 text-blue-500" title="已进行AI消化" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
            </div>
          </div>
        </div>
      </div>

      <!-- 更早 -->
      <div v-if="earlierArticles.length" class="space-y-2">
        <div class="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center">
          <svg class="w-3 h-3 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          上周 (Last Week)
        </div>
        <div
          v-for="article in earlierArticles"
          :key="article.id"
          class="bg-white border border-gray-200 p-3 rounded-xl hover:shadow-md hover:border-blue-400 transition cursor-pointer space-y-2"
          @click="openDetail(article)"
        >
          <div class="flex items-start justify-between">
            <div class="flex items-center space-x-2">
              <div class="w-4 h-4 rounded bg-red-50 flex items-center justify-center flex-shrink-0">
                <svg class="w-2.5 h-2.5 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="2" ry="2"/><rect x="9" y="9" width="6" height="6"/><path d="M15 2v2"/><path d="M15 20v2"/><path d="M2 15h2"/><path d="M2 9h2"/><path d="M20 15h2"/><path d="M20 9h2"/><path d="M9 2v2"/><path d="M9 20v2"/></svg>
              </div>
              <span class="text-[10px] text-gray-400 font-medium truncate">{{ article.siteName }}</span>
            </div>
            <span class="text-[10px] text-gray-400">{{ article.createdAt }}</span>
          </div>
          <div class="text-xs font-bold text-gray-900 leading-tight">{{ article.title }}</div>
          <p class="text-[11px] text-gray-500 line-clamp-2">{{ article.excerpt }}</p>
          <div class="flex items-center justify-between pt-1 border-t border-gray-50">
            <div class="flex space-x-1">
              <span
                v-for="tag in article.tags?.slice(0, 2)"
                :key="tag"
                class="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded text-[9px] font-medium"
              >#{{ tag }}</span>
            </div>
            <div class="flex space-x-1">
              <svg class="w-3 h-3 text-blue-500" title="已进行AI消化" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
            </div>
          </div>
        </div>
      </div>

      <!-- 空状态 -->
      <div v-if="filtered.length === 0" class="px-4 py-7 text-center text-gray-400">
        <div class="text-sm font-bold text-gray-600">没有匹配文章</div>
        <div class="mt-1.5 text-xs">换个关键词，或回到采集页保存当前网页。</div>
      </div>
    </div>

    <!-- 详情弹窗 (reka-ui Dialog) -->
    <DialogRoot :open="dialogOpen" @update:open="v => { if (!v) closeDetail() }">
      <DialogPortal>
        <DialogOverlay class="fixed inset-0 bg-black/20 z-40" />
        <DialogContent
          class="fixed inset-y-0 right-0 w-full bg-white z-50 flex flex-col justify-between outline-none data-[state=open]:animate-slideInRight data-[state=closed]:animate-slideOutRight"
          @pointer-down-outside="closeDetail"
          @escape-key-down="closeDetail"
        >
          <div v-if="selectedArticle" class="flex-grow overflow-y-auto p-4 space-y-4" style="scrollbar-width: none">
            <!-- 详情头部 -->
            <div class="flex items-center justify-between border-b border-gray-100 pb-3">
              <button
                class="text-gray-400 hover:text-gray-600 flex items-center text-xs space-x-1 bg-transparent border-0 cursor-pointer p-0 transition"
                @click="closeDetail"
              >
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
                <span>返回列表</span>
              </button>
              <span class="text-[10px] text-gray-400 font-mono">ID: {{ selectedArticle.id }}</span>
            </div>

            <!-- 详情标题 -->
            <DialogTitle class="text-sm font-bold text-gray-900 leading-snug">
              {{ selectedArticle.title }}
            </DialogTitle>

            <!-- YAML Frontmatter -->
            <div class="bg-gray-950 text-green-400 p-3 rounded-xl font-mono text-[10px] overflow-x-auto space-y-1">
              <div>---</div>
              <div>title: "{{ selectedArticle.title }}"</div>
              <div>url: "{{ selectedArticle.url }}"</div>
              <div>clipped_at: "{{ selectedArticle.createdAt }}"</div>
              <div>tags: [{{ selectedArticle.tags?.map(t => `"#${t}"`).join(', ') }}]</div>
              <div>---</div>
            </div>

            <!-- Markdown 正文 -->
            <div class="space-y-2">
              <span class="text-xs font-bold text-gray-400 block tracking-wider uppercase">Obsidian Markdown 正文段落</span>
              <DialogDescription as="article" class="text-xs text-gray-600 leading-relaxed space-y-2 block">
                <p class="font-semibold text-gray-950">{{ selectedArticle.excerpt }}</p>
                <p>{{ selectedArticle.markdown?.slice(0, 200) }}...</p>
                <p class="border-l-2 border-amber-400 bg-amber-50 p-2 text-amber-900 italic">
                  "By offloading cognitive burden, you liberate mental capacity for deep creative work..." [W3C Text Quote Anchor]
                </p>
              </DialogDescription>
            </div>
          </div>

          <!-- 抽屉底部导出 -->
          <div v-if="selectedArticle" class="p-4 border-t border-gray-100 bg-gray-50 flex space-x-2">
            <button
              class="flex-grow bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-xl text-xs transition flex items-center justify-center space-x-1.5 shadow-sm cursor-pointer border-0"
              @click="exportSingleObsidian"
            >
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              <span>导出 Obsidian Markdown 文件</span>
            </button>
            <DialogClose as-child>
              <button
                class="bg-gray-200 hover:bg-gray-300 text-gray-700 py-2 px-3 rounded-xl text-xs transition cursor-pointer border-0"
              >
                关闭
              </button>
            </DialogClose>
          </div>
        </DialogContent>
      </DialogPortal>
    </DialogRoot>
  </section>
</template>

<style scoped>
@keyframes slideInRight {
  from { transform: translateX(100%); }
  to { transform: translateX(0); }
}
@keyframes slideOutRight {
  from { transform: translateX(0); }
  to { transform: translateX(100%); }
}
:deep([data-state="open"]) {
  animation: slideInRight 300ms ease;
}
:deep([data-state="closed"]) {
  animation: slideOutRight 300ms ease;
}
</style>
