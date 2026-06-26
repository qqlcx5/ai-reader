<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue'
import TopBar from '@/components/layout/TopBar.vue'
import BottomNav from '@/components/layout/BottomNav.vue'
import Toast from '@/components/common/Toast.vue'
import ConfirmModal from '@/components/common/ConfirmModal.vue'
import CaptureView from '@/components/views/CaptureView.vue'
import LibraryView from '@/components/views/LibraryView.vue'
import ReaderView from '@/components/views/ReaderView.vue'
import SettingsView from '@/components/views/SettingsView.vue'
import { useArticleStore } from '@/stores/article.store'
import { useSettingsStore } from '@/stores/settings.store'
import { provideToast } from '@/composables/useToast'
import { getActiveTab } from '@/messaging/client'
import type { Article, PopupView, ToastType } from '@/domain'

// ---- Stores ----
const articleStore = useArticleStore()
const settingsStore = useSettingsStore()

// ---- Toast (composable-driven) ----
const { toast, showToast: rawShowToast } = provideToast()

// ---- Local UI State ----
const currentView = ref<PopupView>('capture')
const deleteTargetId = ref<string | null>(null)
const deleteLoading = ref(false)
const currentPage = ref<Article | null>(null)

// ---- Computed ----
const activeArticle = computed(() =>
  articleStore.articles.find((a) => a.id === articleStore.activeArticleId) || null,
)

// ---- Navigation ----
function navigate(view: PopupView) {
  currentView.value = view
}

function openReader(id: string) {
  articleStore.setActiveArticle(id)
  currentView.value = 'reader'
}

// ---- Toast (delegates to composable) ----
function showToast(arg: string | ToastType, desc?: string) {
  if (typeof arg === 'string') {
    rawShowToast('success', arg, desc)
  } else {
    rawShowToast(arg.type, arg.title, arg.description, arg.duration)
  }
}

// ---- Delete ----
function confirmDelete(id: string) {
  deleteTargetId.value = id
}

async function handleDeleteConfirm() {
  if (!deleteTargetId.value) return
  const targetId = deleteTargetId.value
  const targetArticle = articleStore.articles.find((a) => a.id === targetId)
  const wasActiveArticle = targetId === articleStore.activeArticleId
  deleteLoading.value = true
  try {
    await articleStore.deleteArticle(targetId)
    showToast('已删除', targetArticle?.title ? `文章已删除 · ${targetArticle.title}` : '文章已从本地文章库移除')

    // Navigation strategy
    if (currentView.value === 'reader' && wasActiveArticle) {
      currentView.value = 'library'
    }
    // LibraryView → stays (list auto-refreshes via store reactivity)
    // CaptureView → stays (recentArticles is computed from store)
    // ReaderView non-current → stays
  } catch (err) {
    showToast('删除失败', err instanceof Error ? err.message : '未知错误')
  } finally {
    deleteTargetId.value = null
    deleteLoading.value = false
  }
}

// ---- Current Page Detection ----
async function detectCurrentPage() {
  try {
    const tab = await getActiveTab()
    currentPage.value = {
      id: `current-${tab.tabId}`,
      title: tab.title,
      url: tab.url,
      siteName: new URL(tab.url).hostname,
      siteLetter: new URL(tab.url).hostname[0]?.toUpperCase() ?? '?',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      markdown: '',
    }
  } catch {
    currentPage.value = null
  }
}

// ---- Lifecycle ----
onMounted(async () => {
  try {
    await articleStore.loadArticles()
  } catch (err) {
    console.error('加载文章失败:', err)
    showToast('加载失败', '无法从 IndexedDB 读取文章')
  }
  try {
    await settingsStore.loadSettings()
  } catch (err) {
    console.error('加载设置失败:', err)
  }
  await detectCurrentPage()
})
</script>

<template>
  <main class="w-full h-full flex flex-col bg-#f6f6f4 relative">
    <TopBar :current-view="currentView" @navigate="navigate" />

    <div class="flex-1 min-h-0 px-3.5 overflow-hidden">
      <CaptureView
        v-if="currentView === 'capture'"
        :current-page="currentPage"
        @navigate="navigate"
        @open-reader="openReader"
        @show-toast="showToast"
        @confirm-delete="confirmDelete"
      />
      <LibraryView
        v-if="currentView === 'library'"
        :articles="articleStore.articles"
        @open-reader="openReader"
        @show-toast="showToast"
        @confirm-delete="confirmDelete"
      />
      <ReaderView
        v-if="currentView === 'reader'"
        :article="activeArticle"
        @back="navigate('library')"
        @confirm-delete="confirmDelete"
        @show-toast="showToast"
      />
      <SettingsView
        v-if="currentView === 'settings'"
        @show-toast="showToast"
      />
    </div>

    <BottomNav
      :current-view="currentView"
      :article-count="articleStore.articles.length"
      @navigate="navigate"
      @show-toast="(type, title, desc) => showToast({ type: type as 'info', title, description: desc })"
    />

    <Toast
      :type="toast?.type ?? 'success'"
      :title="toast?.title ?? ''"
      :desc="toast?.description ?? ''"
      :duration="toast?.duration"
    />

    <ConfirmModal
      v-if="deleteTargetId"
      title="删除这篇文章？"
      desc="删除后会从本地文章库移除。"
      :loading="deleteLoading"
      @cancel="deleteTargetId = null; deleteLoading = false"
      @confirm="handleDeleteConfirm"
    />
  </main>
</template>
