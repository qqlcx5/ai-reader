<script setup lang="ts">
import { Brain, Settings } from '@lucide/vue'
import { usePopupStore } from '@/stores/popup'
import IconButton from './IconButton.vue'

const popup = usePopupStore()
</script>

<template>
  <header class="flex items-center justify-between px-4 py-3 bg-card border-b border-gray-200/60 flex-shrink-0">
    <div class="flex items-center gap-2">
      <div class="w-8 h-8 bg-gradient-to-br from-blue to-blue-400 rounded-lg flex items-center justify-center shadow-sm shadow-blue/20">
        <Brain class="w-5 h-5 text-white" />
      </div>
      <div>
        <h1 class="text-sm font-bold tracking-tight leading-none">SuperBrain</h1>
        <p class="text-10px text-gray-400 leading-tight">Local-First AI Clipper</p>
      </div>
    </div>

    <div class="flex items-center gap-2">
      <span class="flex items-center text-10px text-green-600 bg-green-50 px-2 py-0.5 rounded-full font-medium">
        <span class="w-1.5 h-1.5 bg-green-500 rounded-full mr-1.5" />
        IndexedDB 本地
      </span>
      <IconButton aria-label="打开设置" @click="popup.setView('settings')">
        <Settings class="w-4 h-4" />
      </IconButton>
    </div>
  </header>
</template>
