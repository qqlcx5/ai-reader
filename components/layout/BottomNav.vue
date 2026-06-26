<script lang="ts" setup>
defineProps<{
  currentView: string
}>()

const emit = defineEmits<{
  navigate: [view: string]
}>()

const tabs = [
  { key: 'capture', label: '采集' },
  { key: 'ai', label: 'AI' },
  { key: 'library', label: '文章库' },
  { key: 'settings', label: '设置' },
]
</script>

<template>
  <nav
    class="h-68px px-3.5 pb-3.5 pt-2.5 grid grid-cols-4 gap-2 flex-shrink-0"
    style="background: linear-gradient(180deg, rgba(255,255,255,0), rgba(255,255,255,0.72) 34%)"
  >
    <button
      v-for="tab in tabs" :key="tab.key"
      class="h-42px rounded-16px text-12px font-bold cursor-pointer transition-all duration-150 hover:bg-white hover:-translate-y-px"
      :class="currentView === tab.key
        ? 'bg-#111 border border-#111 text-white shadow-lg shadow-black/16'
        : 'border border-rgba(29,29,31,0.08) bg-white/68 text-#52525b'"
      @click="emit('navigate', tab.key)"
    >
      {{ tab.label }}
    </button>
  </nav>
</template>
