<script lang="ts" setup>
import { ref } from 'vue'
import Toast from '@/components/common/Toast.vue'
import CaptureView from '@/components/views/CaptureView.vue'
import AIView from '@/components/views/AIView.vue'
import LibraryView from '@/components/views/LibraryView.vue'
import SettingsView from '@/components/views/SettingsView.vue'
import { currentPage, demoArticles } from '@/components/data'
import type { Article } from '@/components/types'

const currentTab = ref('clip')
const articles = ref<Article[]>([...demoArticles])
const toastTitle = ref('')
const toastDesc = ref('')

const tabs = [
  { key: 'clip', label: '当前网页', icon: 'paperclip' },
  { key: 'ai', label: 'AI 消化', icon: 'sparkles' },
  { key: 'history', label: '我的大脑', icon: 'database' },
]

function switchTab(tab: string) {
  currentTab.value = tab
}

function showToast(title: string, desc: string) {
  toastTitle.value = title
  toastDesc.value = desc
}
</script>

<template>
  <div class="bg-gray-50 text-gray-800 font-sans h-screen flex flex-col justify-between overflow-hidden" style="font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'PingFang SC', 'Microsoft YaHei', sans-serif; -webkit-font-smoothing: antialiased">
    <!-- HEADER: 全局导航与状态控制 -->
    <header class="bg-white border-b border-gray-200 px-4 py-3 flex-shrink-0">
      <div class="flex items-center justify-between">
        <div class="flex items-center space-x-2">
          <div class="w-8 h-8 bg-gradient-to-tr from-blue-600 to-blue-400 rounded-lg flex items-center justify-center shadow-sm shadow-blue-200">
            <svg class="text-white w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/><path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/><path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4"/><path d="M17.599 6.5a3 3 0 0 0 .399-1.375"/><path d="M6.003 5.125A3 3 0 0 0 6.401 6.5"/><path d="M3.477 10.896a4 4 0 0 1 .585-.396"/><path d="M19.938 10.5a4 4 0 0 1 .585.396"/><path d="M6 18a4 4 0 0 1-1.967-.516"/><path d="M19.967 17.484A4 4 0 0 1 18 18"/></svg>
          </div>
          <div>
            <h1 class="text-sm font-bold text-gray-900 tracking-tight flex items-center">
              SuperBrain
              <span class="ml-1.5 px-1.5 py-0.5 text-[10px] font-medium bg-blue-50 text-blue-600 rounded">MV3 v1.0</span>
            </h1>
            <p class="text-[10px] text-gray-400">Local-First AI Clipper</p>
          </div>
        </div>
        <!-- 右上角状态显示 -->
        <div class="flex items-center space-x-3">
          <span class="flex items-center text-[11px] text-green-600 bg-green-50 px-2 py-0.5 rounded-full font-medium">
            <span class="w-1.5 h-1.5 bg-green-500 rounded-full mr-1.5 animate-pulse"></span>
            WebDAV 已同步
          </span>
          <button
            class="text-gray-400 hover:text-gray-600 transition bg-transparent cursor-pointer"
            @click="switchTab('settings')"
          >
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
        </div>
      </div>

      <!-- 标签页导航 (Tabs) -->
      <nav class="flex space-x-1 mt-3 bg-gray-100 p-1 rounded-lg">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          class="flex-1 py-1.5 px-2 text-xs font-medium rounded-md transition duration-150 flex items-center justify-center space-x-1.5 border-0 cursor-pointer"
          :class="currentTab === tab.key
            ? 'bg-white text-gray-900 shadow-sm'
            : 'text-gray-500 hover:text-gray-900 bg-transparent'"
          @click="switchTab(tab.key)"
        >
          <svg v-if="tab.icon === 'paperclip'" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
          <svg v-else-if="tab.icon === 'sparkles'" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
          <svg v-else-if="tab.icon === 'database'" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19A9 3 0 0 0 21 19V5"/><path d="M3 12A9 3 0 0 0 21 12"/></svg>
          <span>{{ tab.label }}</span>
        </button>
      </nav>
    </header>

    <!-- CONTENT: 主体视图区 -->
    <main class="flex-grow overflow-y-auto relative bg-white" style="scrollbar-width: none">
      <CaptureView
        v-if="currentTab === 'clip'"
        :page-title="currentPage.title"
        :page-url="currentPage.url"
        :page-author="currentPage.author"
        :page-date="currentPage.publishedAt"
        :page-excerpt="currentPage.excerpt"
        :page-markdown="currentPage.markdown"
        @show-toast="showToast"
      />
      <AIView
        v-if="currentTab === 'ai'"
        @show-toast="showToast"
      />
      <LibraryView
        v-if="currentTab === 'history'"
        :articles="articles"
        @show-toast="showToast"
      />
      <SettingsView
        v-if="currentTab === 'settings'"
        @show-toast="showToast"
      />
    </main>

    <!-- FOOTER: 数据库物理连接与审计 -->
    <footer class="bg-gray-50 border-t border-gray-200 px-4 py-2 flex-shrink-0 flex items-center justify-between text-[10px] text-gray-400">
      <div class="flex items-center space-x-1.5">
        <svg class="w-3.5 h-3.5 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>
        <span class="font-medium">IndexedDB 本地隔离沙盒连接成功</span>
      </div>
      <div class="font-mono">SQLite Size: 2.4 MB</div>
    </footer>

    <Toast :title="toastTitle" :desc="toastDesc" />
  </div>
</template>
