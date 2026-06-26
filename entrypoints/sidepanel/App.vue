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
    </header>

    <!-- Content -->
    <BaseTabs v-model="activeTab" :tabs="tabs" class="flex-1 flex flex-col overflow-hidden">
      <template #chat>
        <ChatPage :current-document="currentDocument" />
      </template>
      <template #search>
        <SearchPage />
      </template>
      <template #timeline>
        <TimelinePage />
      </template>
      <template #settings>
        <SettingsPage />
      </template>
    </BaseTabs>
  </div>
</template>

<script setup lang="ts">
import ChatPage from './pages/ChatPage.vue'
import SearchPage from './pages/SearchPage.vue'
import TimelinePage from './pages/TimelinePage.vue'
import SettingsPage from './pages/SettingsPage.vue'
import { BaseTabs } from '@/components/ui'
import { useCaptureEvents } from './use-capture-events'

const tabs = [
  { id: 'chat', label: 'Chat', icon: '📖' },
  { id: 'search', label: 'Search', icon: '🔍' },
  { id: 'timeline', label: 'Timeline', icon: '🕐' },
  { id: 'settings', label: 'Settings', icon: '⚙' },
]

const { activeTab, currentDocument, captureCount } = useCaptureEvents({ initialTab: 'chat' })
</script>
