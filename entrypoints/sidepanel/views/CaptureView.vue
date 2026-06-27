<script setup lang="ts">
import { computed, ref } from 'vue'
import { Save, FileOutput, Sparkles, Quote, Anchor, ArrowUpRight, Link, Eye } from '@lucide/vue'
import { useCaptureStore } from '@/stores/capture'
import { useLibraryStore } from '@/stores/library'
import { useCapture } from '../composables/useCapture'
import { useToast } from '../composables/useToast'
import { articleRepo } from '@/db/article.repository'
import { exportArticleObsidian, downloadFile } from '@/core/export/obsidian-exporter'
import type { SavedArticle } from '@/shared/domain'
import ExtractPipeline from './ExtractPipeline.vue'

const captureStore = useCaptureStore()
const libraryStore = useLibraryStore()
const { startCapture } = useCapture()
const toast = useToast()

const metaTitle = ref('如何构建第二大脑 (How to Build a Second Brain)')
const metaAuthor = ref('Tiago Forte')
const metaDate = ref('2022-06-14')

const extractResult = computed(() => captureStore.extractResult)
const markdown = computed(() => {
  if (captureStore.isSuccess && captureStore.markdown) return captureStore.markdown
  return `---
title: How to Build a Second Brain
author: Tiago Forte
---
# Introduction to PKM
A Second Brain is an **external, digital repository** for everything you learn, remember, and process. By offloading cognitive burden, you liberate mental capacity for deep creative work.
## The CODE Method
CODE stands for: *Capture, Organize, Distill, Express*. These four pillars govern the lifecycle of modern digital knowledge asset preservation...`
})

const isSuccess = computed(() => captureStore.isSuccess)
const isIdle = computed(() => captureStore.isIdle)

const isSaving = ref(false)

function buildArticlePayload(): SavedArticle {
  const result = captureStore.extractResult
  const md = captureStore.markdown
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    title: metaTitle.value.trim() || (result?.title ?? 'Untitled'),
    url: result?.url ?? '',
    siteName: result?.siteName ?? '',
    author: metaAuthor.value.trim() || (result?.author ?? ''),
    publishedAt: metaDate.value || (result?.publishedAt ?? ''),
    excerpt: result?.excerpt ?? '',
    markdown: md,
    contentHtml: result?.contentHtml ?? '',
    contentText: result?.contentText ?? '',
    faviconUrl: result?.faviconUrl ?? '',
    image: result?.image ?? '',
    readingTime: result?.readingTime ?? 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

async function handleSave() {
  try {
    isSaving.value = true
    const article = buildArticlePayload()
    await articleRepo.save(article)
    libraryStore.addArticle(article)
    toast.showSuccess('已存入本地知识库', article.title)
  } catch (err: any) {
    toast.showError('保存失败', err.message ?? '请检查存储空间')
  } finally {
    isSaving.value = false
  }
}

function handleExportMarkdown() {
  const article = buildArticlePayload()
  const result = exportArticleObsidian(article)
  downloadFile(result.filename, result.content)
  toast.showSuccess('已下载', result.filename)
}
</script>

<template>
  <div class="p-4 space-y-4">
    <!-- 1.1 Auto-extract success banner -->
    <div class="p-3 bg-blue-50/50 rounded-xl border border-blue-100 flex items-start space-x-3">
      <div class="p-2 bg-blue-500 rounded-lg text-white flex-shrink-0">
        <Sparkles class="w-4 h-4" />
      </div>
      <div class="flex-grow">
        <h3 class="text-xs font-semibold text-blue-900">网页正文自动提取成功</h3>
        <p class="text-11px text-blue-700/80 mt-0.5">Mozilla Readability 已精准剥离广告与侧边栏干扰元素。</p>
      </div>
    </div>

    <!-- 1.2 Metadata panel (editable) -->
    <div class="space-y-2.5">
      <div class="text-xs font-semibold text-gray-400 tracking-wider uppercase">元数据（可编辑）</div>
      <div class="space-y-2 bg-gray-50 p-3 rounded-xl border border-gray-200">
        <div>
          <label class="text-10px font-bold text-gray-400 block mb-1 uppercase">标题 (Title)</label>
          <input
            v-model="metaTitle"
            type="text"
            class="w-full text-xs font-semibold bg-white border border-gray-200 rounded px-2.5 py-1.5 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
          >
        </div>
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="text-10px font-bold text-gray-400 block mb-1 uppercase">作者 (Author)</label>
            <input
              v-model="metaAuthor"
              type="text"
              class="w-full text-xs bg-white border border-gray-200 rounded px-2.5 py-1 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
            >
          </div>
          <div>
            <label class="text-10px font-bold text-gray-400 block mb-1 uppercase">发布时间</label>
            <input
              v-model="metaDate"
              type="text"
              class="w-full text-xs bg-white border border-gray-200 rounded px-2.5 py-1 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
            >
          </div>
        </div>
        <div>
          <label class="text-10px font-bold text-gray-400 block mb-1 uppercase">原始 URL</label>
          <div class="flex items-center space-x-1.5 bg-gray-100 rounded px-2.5 py-1">
            <Link class="w-3 h-3 text-gray-400 flex-shrink-0" />
            <span class="text-11px text-gray-600 truncate">https://fortelabs.com/blog/how-to-build-a-second-brain</span>
          </div>
        </div>
        <div>
          <label class="text-10px font-bold text-gray-400 block mb-1 uppercase">SEO Keywords (解析值)</label>
          <div class="flex flex-wrap gap-1">
            <span class="px-2 py-0.5 bg-gray-200 text-gray-700 text-10px rounded-md font-medium">PKM</span>
            <span class="px-2 py-0.5 bg-gray-200 text-gray-700 text-10px rounded-md font-medium">Productivity</span>
            <span class="px-2 py-0.5 bg-gray-200 text-gray-700 text-10px rounded-md font-medium">Second Brain</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 1.3 Markdown Preview -->
    <div class="space-y-2">
      <div class="flex items-center justify-between">
        <span class="text-xs font-semibold text-gray-400 tracking-wider uppercase">正文 Markdown 预览 (5,240 字符)</span>
        <button class="text-xs text-blue-500 hover:text-blue-600 flex items-center space-x-1 bg-transparent border-0 cursor-pointer">
          <Eye class="w-3 h-3" />
          <span>预览 HTML</span>
        </button>
      </div>
      <div class="relative bg-gray-900 text-gray-200 p-4 rounded-xl text-xs font-mono max-h-48 overflow-y-auto border border-gray-800 shadow-inner">
        <div class="absolute top-2 right-2 px-1.5 py-0.5 bg-gray-800 text-gray-400 rounded text-9px">COMMONMARK</div>
        <p class="text-green-400">---<br>title: How to Build a Second Brain<br>author: Tiago Forte<br>---</p>
        <p class="mt-2 text-blue-400"># Introduction to PKM</p>
        <p class="mt-1">A Second Brain is an <strong>external, digital repository</strong> for everything you learn, remember, and process. By offloading cognitive burden, you liberate mental capacity for deep creative work.</p>
        <p class="mt-2 text-blue-400">## The CODE Method</p>
        <p class="mt-1">CODE stands for: <em>Capture, Organize, Distill, Express</em>. These four pillars govern the lifecycle of modern digital knowledge asset preservation...</p>
      </div>
    </div>

    <!-- 1.4 Highlight & Quote -->
    <div class="space-y-2">
      <div class="flex items-center justify-between">
        <span class="text-xs font-semibold text-gray-400 tracking-wider uppercase">划词高亮 (W3C Text Quote Anchor)</span>
        <span class="text-10px text-gray-400">已捕捉 1 条金句</span>
      </div>
      <div class="p-3 bg-amber-50/50 border border-amber-200 rounded-xl space-y-2">
        <div class="flex items-start space-x-2">
          <Quote class="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <blockquote class="text-xs text-amber-900 leading-relaxed font-serif italic">
            "...By offloading cognitive burden, you liberate mental capacity for deep creative work..."
          </blockquote>
        </div>
        <div class="flex items-center justify-between text-10px text-amber-700/80 pt-1 border-t border-amber-100">
          <span class="flex items-center"><Anchor class="w-2.5 h-2.5 mr-1" /> W3C 精准锚点已就绪</span>
          <a href="#" class="hover:underline flex items-center text-blue-600 no-underline">
            测试回跳
            <ArrowUpRight class="w-2.5 h-2.5 ml-0.5" />
          </a>
        </div>
      </div>
    </div>

    <!-- 1.5 Action buttons -->
    <div class="pt-2 flex space-x-2">
      <button
        class="flex-grow bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2.5 px-4 rounded-xl text-xs transition shadow-sm flex items-center justify-center space-x-2 border-0 cursor-pointer"
        @click="handleSave"
      >
        <Save class="w-4 h-4" />
        <span>一键存入 IndexedDB 数据库</span>
      </button>
      <button
        class="bg-gray-100 hover:bg-gray-200 text-gray-700 p-2.5 rounded-xl transition flex-shrink-0 border-0 cursor-pointer"
        title="导出为 Obsidian Markdown"
        @click="handleExportMarkdown"
      >
        <FileOutput class="w-4 h-4" />
      </button>
    </div>
  </div>
</template>
