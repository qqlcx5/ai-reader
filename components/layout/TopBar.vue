<script lang="ts" setup>
import { computed } from 'vue'
import { useArticleStore } from '@/stores/article.store'
import type { PopupView } from '@/domain'

defineProps<{
  currentView: PopupView
}>()

const emit = defineEmits<{
  navigate: [view: PopupView]
}>()

const articleStore = useArticleStore()

const localStatus = computed(() => {
  // IndexedDB 可用性：通过 store 是否成功加载判断
  if (articleStore.loading) return { label: 'Loading', color: '#a1a1aa', bg: 'rgba(161,161,170,0.08)', border: 'rgba(161,161,170,0.15)', dot: '#a1a1aa' }
  // Dexie 初始化成功即认为可用
  return { label: 'Local', color: '#15803d', bg: 'rgba(22,163,74,0.08)', border: 'rgba(22,163,74,0.15)', dot: '#16a34a' }
})
</script>

<template>
  <header
    class="h-64px px-3.5 pt-3.5 pb-2.5 flex items-center justify-between flex-shrink-0"
  >
    <div class="flex items-center gap-2.5">
      <div
        class="w-36px h-36px rounded-13px grid place-items-center text-white font-bold tracking-tight"
        style="background: linear-gradient(145deg, #111111, #3f3f46); box-shadow: inset 0 1px 0 rgba(255,255,255,0.2), 0 12px 24px rgba(0,0,0,0.18)"
      >
        P
      </div>
      <div>
        <div class="text-14px font-bold tracking-tight">PageMind</div>
        <div class="mt-px text-11px text-#6e6e73">Readable web, saved locally</div>
      </div>
    </div>

    <div class="flex items-center gap-2">
      <div
        class="h-28px inline-flex items-center gap-1.5 px-2.5 rounded-full text-11px font-semibold"
        :style="`background: ${localStatus.bg}; border: 1px solid ${localStatus.border}; color: ${localStatus.color}`"
      >
        <span
          class="w-7px h-7px rounded-full"
          :style="`background: ${localStatus.dot}; box-shadow: 0 0 0 4px ${localStatus.dot}20`"
        />
        {{ localStatus.label }}
      </div>
      <button
        class="w-32px h-32px rounded-12px border border-#e4e4e7 bg-white/72 color-#3f3f46 cursor-pointer transition-all duration-150 hover:bg-white hover:border-#d4d4d8 hover:-translate-y-px"
        title="设置"
        @click="emit('navigate', 'settings')"
      >
        ⌘
      </button>
    </div>
  </header>
</template>
