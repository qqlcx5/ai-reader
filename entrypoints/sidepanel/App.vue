<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { usePopupStore } from '@/stores/popup'
import { initLocale } from '@/i18n'
import PopupTopBar from './components/PopupTopBar.vue'
import ToastHost from './components/ToastHost.vue'
import ConfirmModal from './components/ConfirmModal.vue'
import DetailOverlay from './components/DetailOverlay.vue'
import CaptureView from './views/CaptureView.vue'
import LibraryView from './views/LibraryView.vue'
import ChatView from './views/ChatView.vue'
import SettingsView from './views/SettingsView.vue'

const popup = usePopupStore()
const activeView = computed(() => popup.activeView)

onMounted(() => { initLocale() })
</script>

<template>
  <div class="w-400px h-660px mx-auto flex flex-col overflow-hidden bg-white text-slate-800 font-sans" role="application" aria-label="SuperBrain Side Panel">
    <PopupTopBar />
    <main class="flex-1 overflow-y-auto no-scrollbar bg-white" aria-label="Content Area">
      <CaptureView v-if="activeView === 'capture'" />
      <ChatView v-if="activeView === 'chat'" />
      <LibraryView v-if="activeView === 'library'" />
      <SettingsView v-if="activeView === 'settings'" />
    </main>
    <DetailOverlay />
    <footer class="bg-gray-50 border-t border-gray-200 px-4 py-2 flex-shrink-0 flex items-center justify-between text-10px text-gray-400">
      <div class="flex items-center space-x-1.5">
        <span class="font-medium">IndexedDB 本地隔离沙盒连接成功</span>
      </div>
      <div class="font-mono">数据存储: 2.4 MB</div>
    </footer>
    <ToastHost />
    <ConfirmModal />
  </div>
</template>
