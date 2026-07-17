<script lang="ts" setup>
import { computed, ref } from 'vue'
import { BookOpen, LayoutPanelTop, RefreshCw } from '@lucide/vue'
import UFloatingBall from '@/components/ui/UFloatingBall.vue'
import UQuickActions, { type QuickActionItem } from '@/components/ui/UQuickActions.vue'

const busy = ref(false)
const error = ref<string | null>(null)
const canCapture = computed(() => /^https?:\/\//.test(location.href))

const items = computed<QuickActionItem[]>(() => [
  {
    key: 'capture',
    label: busy.value ? '抓取中...' : '抓取页面',
    description: canCapture.value ? '抓取当前网页' : '当前页面不支持抓取',
    icon: RefreshCw,
    disabled: !canCapture.value,
    loading: busy.value,
  },
  { key: 'workspace', label: '打开工作区', icon: LayoutPanelTop },
  { key: 'library', label: '打开记忆库', icon: BookOpen },
])

async function select(item: QuickActionItem) {
  if (item.key === 'capture') {
    busy.value = true
    error.value = null
  }
  try {
    const response = await browser.runtime.sendMessage({
      type: item.key === 'capture' ? 'FLOATING_CAPTURE' : 'FLOATING_OPEN',
      payload: { view: item.key === 'capture' ? undefined : item.key },
    })
    if (response?.ok === false) throw new Error(response.message || '操作失败')
  } catch (err) {
    error.value = err instanceof Error ? err.message : '操作失败'
  } finally {
    if (item.key === 'capture') busy.value = false
  }
}
</script>

<template>
  <UFloatingBall v-slot="{ edge }">
    <UQuickActions :items="items" :floating="false" :side="edge" @select="select">
      <template #trigger>✦</template>
    </UQuickActions>
  </UFloatingBall>
  <span v-if="error" class="sr-only" role="status">{{ error }}</span>
</template>
