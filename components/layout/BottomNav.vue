<script lang="ts" setup>
import { TabsRoot, TabsList, TabsTrigger } from 'reka-ui'

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
  <TabsRoot
    :model-value="currentView"
    @update:model-value="v => emit('navigate', v)"
    class="h-68px px-3.5 pb-3.5 pt-2.5 flex-shrink-0"
    style="background: linear-gradient(180deg, rgba(255,255,255,0), rgba(255,255,255,0.72) 34%)"
  >
    <TabsList class="grid grid-cols-4 gap-2 h-full">
      <TabsTrigger
        v-for="tab in tabs"
        :key="tab.key"
        :value="tab.key"
        class="h-42px rounded-16px text-12px font-bold cursor-pointer transition-all duration-150 hover:bg-white hover:-translate-y-px border data-[state=active]:bg-#111 data-[state=active]:border-#111 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-black/16 border-rgba(29,29,31,0.08) bg-white/68 text-#52525b"
      >
        {{ tab.label }}
      </TabsTrigger>
    </TabsList>
  </TabsRoot>
</template>
