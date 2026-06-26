<script lang="ts" setup>
import type { PopupView } from '@/domain'

const { articleCount } = defineProps<{
  currentView: PopupView
  articleCount: number
}>()

const emit = defineEmits<{
  navigate: [view: PopupView]
  showToast: [type: 'info', title: string, description?: string]
}>()

const tabs: { key: PopupView; label: string }[] = [
  { key: 'capture', label: '采集' },
  { key: 'library', label: '文章库' },
  { key: 'reader', label: '阅读' },
]

function handleTabClick(key: PopupView) {
  if (key === 'reader') {
    // 阅读 tab：无文章时提示
    if (articleCount === 0) {
      emit('showToast', 'info', '先保存一篇文章', '暂无文章可阅读，请先在采集页保存网页')
      return
    }
  }
  emit('navigate', key)
}
</script>

<template>
  <nav
    class="h-68px px-3.5 pb-3.5 pt-2.5 grid grid-cols-3 gap-2 flex-shrink-0"
    style="background: linear-gradient(180deg, rgba(255,255,255,0), rgba(255,255,255,0.72) 34%)"
  >
    <button
      v-for="tab in tabs" :key="tab.key"
      class="h-42px rounded-16px text-12px font-bold cursor-pointer transition-all duration-150 hover:bg-white hover:-translate-y-px"
      :class="currentView === tab.key
        ? 'bg-#111 border border-#111 text-white shadow-lg shadow-black/16'
        : 'border border-rgba(29,29,31,0.08) bg-white/68 text-#52525b'"
      @click="handleTabClick(tab.key)"
    >
      {{ tab.label }}
    </button>
  </nav>
</template>
