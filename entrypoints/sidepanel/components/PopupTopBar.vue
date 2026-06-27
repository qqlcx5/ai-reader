<script setup lang="ts">
import { computed } from 'vue'
import { Brain, Settings, Paperclip, Sparkles, Database } from '@lucide/vue'
import { usePopupStore, type PopupView } from '@/stores/popup'

const popup = usePopupStore()

const tabs: { key: PopupView; label: string; icon: typeof Brain }[] = [
  { key: 'capture', label: '当前网页', icon: Paperclip },
  { key: 'chat', label: 'AI 消化', icon: Sparkles },
  { key: 'library', label: '我的大脑', icon: Database },
]

const activeTab = computed(() => popup.activeView)
</script>

<template>
  <header class="bg-white border-b border-gray-200 px-4 py-3 flex-shrink-0">
    <div class="flex items-center justify-between">
      <div class="flex items-center space-x-2">
        <div class="w-8 h-8 bg-gradient-to-tr from-blue-600 to-blue-400 rounded-lg flex items-center justify-center shadow-sm shadow-blue-200">
          <Brain class="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 class="text-sm font-bold text-gray-900 tracking-tight flex items-center">
            SuperBrain
            <span class="ml-1.5 px-1.5 py-0.5 text-10px font-medium bg-blue-50 text-blue-600 rounded">MV3 v1.0</span>
          </h1>
          <p class="text-10px text-gray-400">Local-First AI Clipper</p>
        </div>
      </div>
      <div class="flex items-center space-x-3">
        <span class="flex items-center text-11px text-green-600 bg-green-50 px-2 py-0.5 rounded-full font-medium">
          <span class="w-1.5 h-1.5 bg-green-500 rounded-full mr-1.5 animate-pulse" />
          WebDAV 已同步
        </span>
        <button
          class="text-gray-400 hover:text-gray-600 transition bg-transparent border-0 cursor-pointer p-0"
          aria-label="打开设置"
          @click="popup.setView('settings')"
        >
          <Settings class="w-4 h-4" />
        </button>
      </div>
    </div>

    <!-- Tab Navigation -->
    <nav class="flex space-x-1 mt-3 bg-gray-100 p-1 rounded-lg">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        class="tab-btn flex-1 py-1.5 px-2 text-xs font-medium rounded-md transition duration-150 flex items-center justify-center space-x-1.5 bg-transparent border-0 cursor-pointer"
        :class="activeTab === tab.key
          ? 'bg-white text-gray-900 shadow-sm'
          : 'text-gray-500 hover:text-gray-900'"
        :aria-label="tab.label"
        @click="popup.setView(tab.key)"
      >
        <component :is="tab.icon" class="w-3.5 h-3.5" />
        <span>{{ tab.label }}</span>
      </button>
    </nav>
  </header>
</template>
