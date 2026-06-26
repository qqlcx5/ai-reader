<script lang="ts" setup>
import { ref, computed } from 'vue'
import TopBar from '@/components/layout/TopBar.vue'
import BottomNav from '@/components/layout/BottomNav.vue'
import Toast from '@/components/common/Toast.vue'
import ConfirmModal from '@/components/common/ConfirmModal.vue'
import CaptureView from '@/components/views/CaptureView.vue'
import LibraryView from '@/components/views/LibraryView.vue'
import ReaderView from '@/components/views/ReaderView.vue'
import SettingsView from '@/components/views/SettingsView.vue'
import { currentPage, demoArticles } from '@/components/data'
import type { Article } from '@/components/types'

const currentView = ref('capture')
const articles = ref<Article[]>([...demoArticles])
const activeArticleId = ref(articles.value[0]?.id || '')
const deleteTargetId = ref<string | null>(null)
const toastTitle = ref('')
const toastDesc = ref('')

const activeArticle = computed(() =>
  articles.value.find((a: Article) => a.id === activeArticleId.value) || null,
)

function navigate(view: string) {
  currentView.value = view
}

function openReader(id: string) {
  activeArticleId.value = id
  currentView.value = 'reader'
}

function showToast(title: string, desc: string) {
  toastTitle.value = title
  toastDesc.value = desc
}
</script>

<template>
  <main class="w-full h-full flex flex-col bg-#f6f6f4 relative">
    <TopBar :current-view="currentView" @navigate="navigate" />

    <div class="flex-1 min-h-0 px-3.5 overflow-hidden">
      <CaptureView
        v-if="currentView === 'capture'"
        :current-page="currentPage"
        :articles="articles"
        @navigate="navigate"
        @open-reader="openReader"
        @show-toast="showToast"
      />
      <LibraryView
        v-if="currentView === 'library'"
        :articles="articles"
        @open-reader="openReader"
        @show-toast="showToast"
      />
      <ReaderView
        v-if="currentView === 'reader'"
        :article="activeArticle"
        @back="navigate('library')"
        @show-toast="showToast"
      />
      <SettingsView
        v-if="currentView === 'settings'"
        @show-toast="showToast"
      />
    </div>

    <BottomNav :current-view="currentView" @navigate="navigate" />

    <Toast :title="toastTitle" :desc="toastDesc" />

    <ConfirmModal
      v-if="deleteTargetId"
      title="删除这篇文章？"
      desc="删除后会从本地文章库移除。"
      @cancel="deleteTargetId = null"
      @confirm="deleteTargetId = null"
    />
  </main>
</template>
