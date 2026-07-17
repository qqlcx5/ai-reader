<script lang="ts" setup>
import { computed, type Component } from 'vue'
import { BookOpen, LayoutPanelTop, RefreshCw, Zap } from '@lucide/vue'
import UQuickActions, { type QuickActionItem } from '@/components/ui/UQuickActions.vue'
import { useAppStore } from '@/stores/app.store'
import { useWorkspaceStore } from '@/stores/workspace.store'
import { isWindowMode } from '@/utils/open-window'

const props = defineProps<{ capturing?: boolean }>()
const emit = defineEmits<{ capture: []; select: [key: string] }>()
const appStore = useAppStore()
const workspaceStore = useWorkspaceStore()

const injectable = computed(() => {
  const url = appStore.activeTab?.url || ''
  return url.startsWith('http://') || url.startsWith('https://')
})
const items = computed<QuickActionItem[]>(() => [
  {
    key: 'capture',
    label: props.capturing ? '抓取中...' : '抓取页面',
    description: injectable.value ? '抓取当前页面内容' : '当前页面不支持抓取',
    icon: RefreshCw,
    disabled: !injectable.value || isWindowMode(),
    loading: props.capturing,
  },
  { key: 'workspace', label: '工作区', icon: LayoutPanelTop },
  { key: 'library', label: '记忆库', icon: BookOpen },
  { key: 'analysis', label: 'AI 分析', icon: Zap },
])

function select(item: QuickActionItem) {
  if (item.key === 'capture') emit('capture')
  else emit('select', item.key)
}
</script>

<template>
  <UQuickActions :items="items" position="right" @select="select">
    <template #trigger>✦</template>
  </UQuickActions>
</template>
