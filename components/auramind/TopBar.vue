<script lang="ts" setup>
import { computed } from 'vue'
import { Sparkles, PanelRight, BookOpen, Settings } from '@lucide/vue'
import { useAppStore } from '@/stores/app.store'
import { useWorkspaceStore } from '@/stores/workspace.store'

const appStore = useAppStore()
const workspaceStore = useWorkspaceStore()

const subtitle = computed(() => {
  switch (appStore.currentView) {
    case 'workspace':
      return workspaceStore.isExtracting ? '正在解析当前页面...' : '当前网页上下文'
    case 'library':
      return '本地知识库'
    case 'settings':
      return '模型与配置'
    default:
      return ''
  }
})

const navItems = [
  { key: 'workspace', icon: PanelRight, label: '工作区' },
  { key: 'library', icon: BookOpen, label: '记忆库' },
  { key: 'settings', icon: Settings, label: '设置' },
] as const
</script>

<template>
  <header class="h-12 shrink-0 glass border-b border-zinc-200 flex items-center justify-between px-3 z-30">
    <div class="flex items-center gap-2 min-w-0">
      <div class="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0">
        <Sparkles class="w-4 h-4 text-brand" />
      </div>
      <div class="min-w-0">
        <div class="text-[13px] font-semibold truncate">AuraMind</div>
        <div class="text-[10px] text-zinc-400 truncate">{{ subtitle }}</div>
      </div>
    </div>

    <div class="flex items-center gap-1">
      <button
        v-for="item in navItems"
        :key="item.key"
        class="p-1.5 rounded-md transition-colors"
        :class="appStore.currentView === item.key ? 'text-brand bg-indigo-50' : 'text-zinc-500 hover:bg-zinc-100'"
        :title="item.label"
        @click="appStore.setCurrentView(item.key)"
      >
        <component :is="item.icon" class="w-4 h-4" />
      </button>
    </div>
  </header>
</template>
