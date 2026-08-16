<script lang="ts" setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { Keyboard } from '@lucide/vue'

/**
 * Press `?` anywhere (outside inputs) to show the shortcut cheat sheet.
 */

const open = ref(false)

const GROUPS = [
  {
    title: '全局',
    items: [
      { keys: 'Ctrl / ⌘ + K', desc: '命令面板（搜文档、跳视图）' },
      { keys: '?', desc: '本速查表' },
      { keys: 'Alt + ←', desc: '返回上一视图' },
    ],
  },
  {
    title: '浏览器级（任意网页）',
    items: [
      { keys: 'Alt + Shift + C', desc: '抓取当前页面' },
      { keys: 'Alt + Shift + R', desc: '打开复习面板' },
    ],
  },
  {
    title: '复习页',
    items: [
      { keys: '空格 / Enter', desc: '翻面' },
      { keys: '1 / 2 / 3 / 4', desc: '忘了 / 困难 / 良好 / 简单（翻面后）' },
    ],
  },
]

function onKeydown(e: KeyboardEvent) {
  const target = e.target as HTMLElement | null
  const typing = !!target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
  if (typing) return
  if (e.key === '?') {
    e.preventDefault()
    open.value = !open.value
  } else if (e.key === 'Escape' && open.value) {
    open.value = false
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-50 bg-black/30 flex items-center justify-center"
      @click.self="open = false"
    >
      <div class="w-[380px] max-w-[92vw] bg-white rounded-2xl shadow-2xl border border-zinc-200 p-4 flex flex-col gap-3">
        <div class="flex items-center gap-2 text-[13px] font-semibold text-zinc-800">
          <Keyboard class="w-4 h-4 text-brand" />
          键盘快捷键
        </div>
        <div v-for="group in GROUPS" :key="group.title" class="flex flex-col gap-1">
          <div class="text-[10px] uppercase tracking-wider text-zinc-400">{{ group.title }}</div>
          <div
            v-for="item in group.items"
            :key="item.keys"
            class="flex items-center justify-between text-[12px] py-1"
          >
            <span class="text-zinc-600">{{ item.desc }}</span>
            <kbd class="text-[10px] font-medium text-zinc-500 bg-zinc-100 border border-zinc-200 rounded px-1.5 py-0.5">{{ item.keys }}</kbd>
          </div>
        </div>
        <div class="text-[10px] text-zinc-400 text-center">按 ? 或 Esc 关闭</div>
      </div>
    </div>
  </Teleport>
</template>
