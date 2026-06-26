<script lang="ts" setup>
import { ref } from 'vue'

const props = defineProps<{
  pageTitle: string
  pageUrl: string
  pageAuthor: string
  pageDate: string
  pageExcerpt: string
  pageMarkdown: string
}>()

const emit = defineEmits<{
  showToast: [title: string, desc: string]
}>()

const saving = ref(false)

const titleInput = ref(props.pageTitle)
const authorInput = ref(props.pageAuthor)
const dateInput = ref(props.pageDate)
const keywords = ['PKM', 'Productivity', 'Second Brain']

function performSave() {
  saving.value = true
  emit('showToast', '已存入 IndexedDB', '网页正文与 YAML 元数据已本地序列化，写入 IndexedDB!')
  setTimeout(() => { saving.value = false }, 1500)
}

function exportMarkdown() {
  const yaml = `---
title: "${props.pageTitle}"
url: "${props.pageUrl}"
author: "${props.pageAuthor}"
---
# ${props.pageTitle}...`
  const blob = new Blob([yaml], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${props.pageTitle.replace(/\s+/g, '_')}.md`
  a.click()
  URL.revokeObjectURL(url)
  emit('showToast', 'Markdown 已导出', '可直接导入 Obsidian 或其他编辑器')
}
</script>

<template>
  <section class="p-4 space-y-4">
    <!-- 自动捕获状态指示 -->
    <div class="p-3 bg-blue-50/50 rounded-xl border border-blue-100 flex items-start space-x-3">
      <div class="p-2 bg-blue-500 rounded-lg text-white flex items-center justify-center">
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
      </div>
      <div class="flex-grow">
        <h3 class="text-xs font-semibold text-blue-900">网页正文自动提取成功</h3>
        <p class="text-[11px] text-blue-700/80 mt-0.5">Mozilla Readability 已精准剥离 3 个广告与侧边栏干扰元素。</p>
      </div>
    </div>

    <!-- 元数据面板 -->
    <div class="space-y-2.5">
      <div class="text-xs font-semibold text-gray-400 tracking-wider uppercase">元数据（可编辑）</div>
      <div class="space-y-2 bg-gray-50 p-3 rounded-xl border border-gray-200">
        <div>
          <label class="text-[10px] font-bold text-gray-400 block mb-1 uppercase">标题 (Title)</label>
          <input
            v-model="titleInput"
            type="text"
            class="w-full text-xs font-semibold bg-white border border-gray-200 rounded px-2.5 py-1.5 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition"
          >
        </div>
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="text-[10px] font-bold text-gray-400 block mb-1 uppercase">作者 (Author)</label>
            <input
              v-model="authorInput"
              type="text"
              class="w-full text-xs bg-white border border-gray-200 rounded px-2.5 py-1 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition"
            >
          </div>
          <div>
            <label class="text-[10px] font-bold text-gray-400 block mb-1 uppercase">发布时间 (Published At)</label>
            <input
              v-model="dateInput"
              type="text"
              class="w-full text-xs bg-white border border-gray-200 rounded px-2.5 py-1 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition"
            >
          </div>
        </div>
        <div>
          <label class="text-[10px] font-bold text-gray-400 block mb-1 uppercase">原始 URL (Canonical Link)</label>
          <div class="flex items-center space-x-1.5 bg-gray-100 rounded px-2.5 py-1">
            <svg class="w-3 h-3 text-gray-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
            <span class="text-[11px] text-gray-600 truncate">{{ pageUrl }}</span>
          </div>
        </div>
        <div>
          <label class="text-[10px] font-bold text-gray-400 block mb-1 uppercase">SEO Keywords (解析值)</label>
          <div class="flex flex-wrap gap-1">
            <span
              v-for="kw in keywords"
              :key="kw"
              class="px-2 py-0.5 bg-gray-200 text-gray-700 text-[10px] rounded-md font-medium"
            >{{ kw }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 正文 Markdown 结构预览 -->
    <div class="space-y-2">
      <div class="flex items-center justify-between">
        <span class="text-xs font-semibold text-gray-400 tracking-wider uppercase">正文 Markdown 预览 (5,240 字符)</span>
        <button class="text-xs text-blue-500 hover:text-blue-600 flex items-center space-x-1 bg-transparent border-0 cursor-pointer p-0 transition">
          <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
          <span>预览 HTML</span>
        </button>
      </div>
      <div class="relative bg-gray-900 text-gray-200 p-4 rounded-xl text-xs font-mono max-h-48 overflow-y-auto border border-gray-800 shadow-inner">
        <div class="absolute top-2 right-2 px-1.5 py-0.5 bg-gray-800 text-gray-400 rounded text-[9px]">COMMONMARK</div>
        <p class="text-green-400">---<br>title: {{ pageTitle }}<br>author: {{ pageAuthor }}<br>---</p>
        <p class="mt-2 text-blue-400"># Introduction to PKM</p>
        <p class="mt-1">A Second Brain is an <span class="text-white">**external, digital repository**</span> for everything you learn, remember, and process. By offloading cognitive burden, you liberate mental capacity for deep creative work.</p>
        <p class="mt-2 text-blue-400">## The CODE Method</p>
        <p class="mt-1">CODE stands for: <span class="text-gray-400 italic">*Capture, Organize, Distill, Express*</span>. These four pillars govern the lifecycle of modern digital knowledge asset preservation...</p>
      </div>
    </div>

    <!-- 高亮与划词摘录模块 -->
    <div class="space-y-2">
      <div class="flex items-center justify-between">
        <span class="text-xs font-semibold text-gray-400 tracking-wider uppercase">划词高亮 (W3C Text Quote Anchor)</span>
        <span class="text-[10px] text-gray-400">已捕捉 1 条金句</span>
      </div>
      <div class="p-3 bg-amber-50/50 border border-amber-200 rounded-xl space-y-2">
        <div class="flex items-start space-x-2">
          <svg class="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="currentColor"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"/></svg>
          <blockquote class="text-xs text-amber-900 leading-relaxed italic" style="font-family: Georgia, serif">
            "...By offloading cognitive burden, you liberate mental capacity for deep creative work..."
          </blockquote>
        </div>
        <div class="flex items-center justify-between text-[10px] text-amber-700/80 pt-1 border-t border-amber-100">
          <span class="flex items-center">
            <svg class="w-2.5 h-2.5 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="3"/><line x1="12" y1="22" x2="12" y2="8"/><path d="M5 12H2a10 10 0 0 0 20 0h-3"/></svg>
            W3C 精准锚点已就绪
          </span>
          <button
            class="hover:underline flex items-center text-blue-600 bg-transparent border-0 text-[10px] cursor-pointer p-0 transition"
            @click="emit('showToast', '回跳测试', '已定位到原文高亮位置')"
          >
            测试回跳
            <svg class="w-2.5 h-2.5 ml-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 7h10v10"/><path d="M7 17 17 7"/></svg>
          </button>
        </div>
      </div>
    </div>

    <!-- 一键本地持久化剪藏按钮 -->
    <div class="pt-2 flex space-x-2">
      <button
        class="flex-grow bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2.5 px-4 rounded-xl text-xs transition shadow-sm flex items-center justify-center space-x-2 cursor-pointer border-0"
        @click="performSave"
      >
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
        <span>一键存入 IndexedDB 数据库</span>
      </button>
      <button
        class="bg-gray-100 hover:bg-gray-200 text-gray-700 p-2.5 rounded-xl transition flex-shrink-0 cursor-pointer border-0"
        title="导出为 Obsidian Markdown"
        @click="exportMarkdown"
      >
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><path d="M12 18v-6"/><path d="m9 15 3 3 3-3"/></svg>
      </button>
    </div>
  </section>
</template>
