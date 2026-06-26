<script setup lang="ts">
import { ref } from 'vue';
import ChatPage from './pages/ChatPage.vue';
import SearchPage from './pages/SearchPage.vue';
import TimelinePage from './pages/TimelinePage.vue';

type TabKey = 'chat' | 'search' | 'timeline';

const activeTab = ref<TabKey>('chat');

const tabs: { key: TabKey; label: string }[] = [
  { key: 'chat', label: '对话' },
  { key: 'search', label: '搜索' },
  { key: 'timeline', label: '时间轴' },
];
</script>

<template>
  <div class="h-screen flex flex-col bg-slate-50 font-sans text-slate-800">
    <!-- Tab Navigation -->
    <nav class="flex border-b border-slate-200 bg-white">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        class="flex-1 py-3 text-sm font-medium transition-colors"
        :class="activeTab === tab.key
          ? 'text-brand-600 border-b-2 border-brand-500'
          : 'text-slate-500 hover:text-slate-700'"
        @click="activeTab = tab.key"
      >
        {{ tab.label }}
      </button>
    </nav>

    <!-- Content -->
    <main class="flex-1 overflow-hidden">
      <ChatPage v-if="activeTab === 'chat'" />
      <SearchPage v-else-if="activeTab === 'search'" />
      <TimelinePage v-else-if="activeTab === 'timeline'" />
    </main>
  </div>
</template>
