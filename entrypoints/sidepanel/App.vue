<template>
  <div class="h-screen flex flex-col bg-slate-50 dark:bg-slate-900">
    <!-- Header -->
    <header class="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
      <div class="flex items-center gap-2">
        <div class="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center text-white">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
          </svg>
        </div>
        <h1 class="font-semibold text-slate-800 dark:text-slate-100">AI Reader</h1>
        <span
          v-if="captureCount > 0"
          class="ml-1 text-xs px-1.5 py-0.5 rounded-full bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300"
          :title="`${captureCount} capture${captureCount === 1 ? '' : 's'}`"
        >{{ captureCount }}</span>
      </div>
      <div class="flex items-center gap-1">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          @click="activeTab = tab.id"
          class="p-2 rounded-lg transition-colors"
          :class="activeTab === tab.id ? 'bg-brand-100 text-brand-600 dark:bg-brand-900/30 dark:text-brand-400' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'"
          :title="tab.label"
        >
          <component :is="tab.icon" class="w-5 h-5" />
        </button>
      </div>
    </header>

    <!-- Content -->
    <main class="flex-1 overflow-hidden">
      <ChatPage v-if="activeTab === 'chat'" :current-document="currentDocument" />
      <SearchPage v-else-if="activeTab === 'search'" />
      <TimelinePage v-else-if="activeTab === 'timeline'" />
      <SettingsPage v-else-if="activeTab === 'settings'" />
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { BookOpen, Search, Clock, Settings } from '@lucide/vue'
import ChatPage from './pages/ChatPage.vue'
import SearchPage from './pages/SearchPage.vue'
import TimelinePage from './pages/TimelinePage.vue'
import SettingsPage from './pages/SettingsPage.vue'
import { useCaptureEvents } from './use-capture-events'

const tabs = [
  { id: 'chat', label: 'Chat', icon: BookOpen },
  { id: 'search', label: 'Search', icon: Search },
  { id: 'timeline', label: 'Timeline', icon: Clock },
  { id: 'settings', label: 'Settings', icon: Settings },
]

const { activeTab, currentDocument, captureCount } = useCaptureEvents({ initialTab: 'chat' })
</script>
