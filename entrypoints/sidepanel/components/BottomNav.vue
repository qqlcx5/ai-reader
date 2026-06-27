<script setup lang="ts">
import { Globe, Database, MessageCircle, Settings } from '@lucide/vue'
import { usePopupStore, type PopupView } from '@/stores/popup'

const popup = usePopupStore()

const tabs: { key: PopupView; label: string; icon: typeof Globe }[] = [
  { key: 'capture', label: '当前网页', icon: Globe },
  { key: 'library', label: '我的大脑', icon: Database },
  { key: 'chat', label: 'AI 对话', icon: MessageCircle },
  { key: 'settings', label: '设置', icon: Settings },
]
</script>

<template>
  <nav class="flex items-center bg-card border-t border-gray-200/60 flex-shrink-0">
    <button
      v-for="tab in tabs"
      :key="tab.key"
      :aria-label="tab.label"
      class="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 transition-colors duration-150 bg-transparent border-0 cursor-pointer"
      :class="popup.activeView === tab.key ? 'text-blue' : 'text-gray-400 hover:text-gray-600'"
      @click="popup.setView(tab.key)"
    >
      <component :is="tab.icon" class="w-5 h-5" />
      <span class="text-10px font-medium">{{ tab.label }}</span>
    </button>
  </nav>
</template>
