<script lang="ts" setup>
import { computed, ref } from 'vue'
import { BookOpen, LayoutPanelTop, Sparkles, Zap } from '@lucide/vue'
import UFloatingBall from '@/components/ui/UFloatingBall.vue'
import AssistantMenu, { type AssistantMenuItem } from '@/components/common/AssistantMenu.vue'

const busy = ref(false)
const error = ref<string | null>(null)
let errorTimer: ReturnType<typeof setTimeout> | null = null
function showError(message: string) {
  error.value = message
  if (errorTimer) clearTimeout(errorTimer)
  errorTimer = setTimeout(() => { error.value = null }, 3000)
}
const canCapture = computed(() => /^https?:\/\//.test(location.href))

const items = computed<AssistantMenuItem[]>(() => [
  {
    key: 'quickread',
    label: busy.value ? '抓取中…' : 'AI 速读本页',
    description: canCapture.value ? '抓取后在工作区直接问答' : '当前页面不支持抓取',
    icon: Zap,
    disabled: !canCapture.value || busy.value,
    loading: busy.value,
  },
  {
    key: 'capture',
    label: '抓取到记忆库',
    icon: Sparkles,
    disabled: !canCapture.value,
  },
  { key: 'workspace', label: '打开工作区', icon: LayoutPanelTop },
  { key: 'library', label: '打开记忆库', icon: BookOpen },
])

async function send(type: 'FLOATING_CAPTURE' | 'FLOATING_OPEN', payload?: Record<string, unknown>) {
  const response = await browser.runtime.sendMessage({ type, payload })
  if (response?.ok === false) throw new Error(response.message || '操作失败')
}

async function select(item: AssistantMenuItem) {
  error.value = null
  try {
    if (item.key === 'quickread') {
      // Capture first, then open workspace — user lands with context attached.
      busy.value = true
      await send('FLOATING_CAPTURE')
      await send('FLOATING_OPEN', { view: 'workspace' })
    } else if (item.key === 'capture') {
      busy.value = true
      await send('FLOATING_CAPTURE')
    } else {
      await send('FLOATING_OPEN', { view: item.key })
    }
  } catch (err) {
    showError(err instanceof Error ? err.message : '操作失败')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <UFloatingBall v-slot="{ edge }">
    <AssistantMenu :items="items" :side="edge" @select="select" />
  </UFloatingBall>
  <div
    v-if="error"
    class="fixed bottom-4 left-1/2 -translate-x-1/2 z-[2147483647] max-w-[90vw] px-3 py-2 rounded-lg bg-red-600 text-white text-[12px] shadow-lg"
    role="status"
  >
    {{ error }}
  </div>
</template>
