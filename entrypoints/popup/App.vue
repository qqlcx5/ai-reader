<template>
  <div class="p-4 min-w-[320px]">
    <div class="flex items-center gap-3 mb-4">
      <div class="w-10 h-10 rounded-xl bg-brand-500 flex items-center justify-center text-white">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
          <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
        </svg>
      </div>
      <div>
        <h1 class="font-bold text-slate-800 dark:text-slate-100">AI Reader</h1>
        <p class="text-xs text-slate-500 dark:text-slate-400">AI 驱动的网页阅读助手</p>
      </div>
    </div>

    <div class="space-y-2">
      <button
        @click="captureAndOpen"
        :disabled="isCapturing"
        class="w-full px-4 py-2.5 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"
      >
        <BookOpen class="w-4 h-4" />
        {{ isCapturing ? '捕获中...' : '捕获当前页面' }}
      </button>

      <button
        @click="openSidePanel"
        class="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-sm font-medium flex items-center justify-center gap-2"
      >
        <MessageSquare class="w-4 h-4" />
        打开侧边栏
      </button>

      <button
        @click="openOptions"
        class="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-sm font-medium flex items-center justify-center gap-2"
      >
        <Settings class="w-4 h-4" />
        设置
      </button>
    </div>

    <div v-if="recentDocs.length > 0" class="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
      <h3 class="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">最近捕获</h3>
      <div class="space-y-1">
        <div
          v-for="doc in recentDocs.slice(0, 3)"
          :key="doc.id"
          @click="openDoc(doc)"
          class="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
        >
          <p class="text-sm text-slate-800 dark:text-slate-100 truncate">{{ doc.title }}</p>
          <p class="text-xs text-slate-400 dark:text-slate-500">{{ doc.siteName }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { BookOpen, MessageSquare, Settings } from '@lucide/vue'
import type { CapturedDocument } from '@/shared/types'

const isCapturing = ref(false)
const recentDocs = ref<CapturedDocument[]>([])

onMounted(async () => {
  const result = await chrome.storage.local.get('ai_reader_recent_docs')
  if (result.ai_reader_recent_docs) {
    recentDocs.value = result.ai_reader_recent_docs
  }
})

async function captureAndOpen() {
  isCapturing.value = true
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
    const activeTab = tabs[0]
    if (!activeTab?.id) return

    const response = await chrome.tabs.sendMessage(activeTab.id, {
      type: 'CAPTURE_PAGE',
      payload: {},
    })

    if (response?.success && response.data) {
      await chrome.runtime.sendMessage({
        type: 'CAPTURE_COMPLETE',
        payload: { document: response.data },
      })

      await chrome.runtime.sendMessage({
        type: 'OPEN_SIDE_PANEL',
        payload: { documentId: response.data.id },
      })

      window.close()
    }
  } catch (err) {
    console.error('Capture failed:', err)
  } finally {
    isCapturing.value = false
  }
}

async function openSidePanel() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
    const activeTab = tabs[0]
    if (activeTab?.id) {
      await chrome.sidePanel.open({ tabId: activeTab.id })
    }
    window.close()
  } catch (err) {
    console.error('Open side panel failed:', err)
  }
}

function openOptions() {
  chrome.runtime.openOptionsPage()
  window.close()
}

async function openDoc(doc: CapturedDocument) {
  await chrome.runtime.sendMessage({
    type: 'OPEN_SIDE_PANEL',
    payload: { documentId: doc.id },
  })
  window.close()
}
</script>
