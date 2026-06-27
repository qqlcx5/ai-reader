<script lang="ts" setup>
import { Database, CloudSync, Search, MessageSquare, Trash2, FileText, Terminal, BookOpen } from '@lucide/vue'
import RekaButton from '@/components/ui/RekaButton.vue'
import Heatmap from './Heatmap.vue'

const documents = [
  { id: '1', title: 'Local-First 软件设计原则与实践指南', source: 'inkandswitch.com', time: '今天 14:30', icon: FileText, iconBg: 'bg-indigo-50 border-indigo-100', iconColor: 'text-brand' },
  { id: '2', title: 'React 18 并发渲染机制深度解析', source: 'Dan Abramov', time: '昨天', icon: Terminal, iconBg: 'bg-orange-50 border-orange-100', iconColor: 'text-orange-500' },
  { id: '3', title: '穷查理宝典 网页提取版', source: '本地 PDF 解析', time: '10-22', icon: BookOpen, iconBg: 'bg-zinc-100 border-zinc-200', iconColor: 'text-zinc-500', faded: true },
]
</script>

<template>
  <div class="flex-1 min-h-0 flex-col bg-[#FCFCFC] flex">
    <!-- Header -->
    <div class="h-12 shrink-0 px-4 flex items-center justify-between border-b border-zinc-200 bg-white/80 backdrop-blur-md">
      <div class="text-[14px] font-semibold text-zinc-900 flex items-center gap-2">
        <Database class="w-4 h-4 text-brand" />
        记忆库
        <span class="text-[11px] font-normal text-zinc-400">5,241 篇</span>
      </div>
      <button class="p-1.5 rounded-md text-zinc-500 hover:bg-zinc-100">
        <CloudSync class="w-4 h-4" />
      </button>
    </div>

    <div class="flex-1 min-h-0 overflow-y-auto">
      <!-- Search -->
      <div class="sticky top-0 z-10 p-4 pb-3 bg-[#FCFCFC]/95 backdrop-blur-md border-b border-zinc-100">
        <div class="h-10 bg-white border border-zinc-200 rounded-xl flex items-center px-3 shadow-sm focus-within:border-brand focus-within:ring-4 focus-within:ring-indigo-50 transition-all">
          <Search class="w-4 h-4 text-zinc-400 mr-2 shrink-0" />
          <input class="flex-1 outline-none bg-transparent text-[13px] placeholder:text-zinc-400" placeholder="搜索知识库、网页、对话..." />
          <kbd class="text-[10px] px-1.5 py-0.5 bg-zinc-100 border border-zinc-200 rounded text-zinc-500 font-mono">&#8984;K</kbd>
        </div>
      </div>

      <!-- Heatmap -->
      <Heatmap />

      <!-- Documents -->
      <div class="p-2 pb-6">
        <div class="px-2 pt-2 pb-1 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">最近捕获</div>

        <article
          v-for="doc in documents"
          :key="doc.id"
          class="group relative p-2.5 rounded-xl hover:bg-white border border-transparent hover:border-zinc-200 hover:shadow-sm cursor-pointer transition-all flex gap-3"
          :class="{ 'opacity-80': doc.faded }"
        >
          <div class="w-7 h-7 rounded-lg border flex items-center justify-center shrink-0" :class="doc.iconBg">
            <component :is="doc.icon" class="w-3.5 h-3.5" :class="doc.iconColor" />
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-[13px] font-medium truncate group-hover:text-brand">{{ doc.title }}</div>
            <div class="text-[11px] text-zinc-500 flex items-center gap-1.5 truncate mt-1">
              <span>{{ doc.source }}</span>
              <span class="w-[3px] h-[3px] rounded-full bg-zinc-300" />
              <span>{{ doc.time }}</span>
            </div>
          </div>
          <div class="hidden group-hover:flex absolute right-2 top-1/2 -translate-y-1/2 bg-white/90 backdrop-blur pl-2">
            <button class="p-1.5 rounded-md text-brand hover:bg-indigo-50">
              <MessageSquare class="w-3.5 h-3.5" />
            </button>
            <button class="p-1.5 rounded-md text-red-500 hover:bg-red-50">
              <Trash2 class="w-3.5 h-3.5" />
            </button>
          </div>
        </article>
      </div>
    </div>
  </div>
</template>
