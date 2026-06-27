<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { usePopupStore } from '@/stores/popup'
import { initLocale } from '@/i18n'
import PopupTopBar from './components/PopupTopBar.vue'
import BottomNav from './components/BottomNav.vue'
import ToastHost from './components/ToastHost.vue'
import ConfirmModal from './components/ConfirmModal.vue'
import CaptureView from './views/CaptureView.vue'
import LibraryView from './views/LibraryView.vue'
import ReaderView from './views/ReaderView.vue'
import ChatView from './views/ChatView.vue'
import SettingsView from './views/SettingsView.vue'
import ExportPanel from '@/components/views/ExportPanel.vue'

const popup = usePopupStore()
const activeView = computed(() => popup.activeView)

onMounted(() => { initLocale() })
</script>

<template>
  <div class="w-400px h-660px mx-auto flex flex-col overflow-hidden bg-bg text-text font-sans" role="application" aria-label="SuperBrain Side Panel">
    <PopupTopBar />
    <main class="flex-1 overflow-y-auto no-scrollbar" aria-label="Content Area">
      <CaptureView v-if="activeView === 'capture'" />
      <LibraryView v-if="activeView === 'library'" />
      <ReaderView v-if="activeView === 'reader'" />
      <ChatView v-if="activeView === 'chat'" />
      <SettingsView v-if="activeView === 'settings'" />
      <ExportPanel v-if="activeView === 'export'" :article="null" :articles="[]" @close="popup.goBack()" />
    </main>
    <BottomNav />
    <ToastHost />
    <ConfirmModal />
  </div>
</template>
