<script lang="ts" setup>
import { computed, onMounted, onUnmounted } from 'vue'
import { Moon, Sun, Monitor } from '@lucide/vue'
import { useSettingsStore } from '@/stores/settings.store'

const settingsStore = useSettingsStore()

const theme = computed({
  get: () => settingsStore.theme,
  set: (val: 'light' | 'dark' | 'system') => settingsStore.updateTheme(val),
})

const options = [
  { key: 'light', label: '亮色', icon: Sun },
  { key: 'dark', label: '暗色', icon: Moon },
  { key: 'system', label: '跟随系统', icon: Monitor },
] as const

// Live-preview while this component is mounted: the app root also applies on
// theme change; this catches the system-follow case.
let media: MediaQueryList | null = null
const onChange = () => applyThemeClass()
function applyThemeClass() {
  const dark = settingsStore.theme === 'dark'
    || (settingsStore.theme === 'system' && media?.matches)
  document.documentElement.classList.toggle('dark', dark)
}
onMounted(() => {
  media = window.matchMedia('(prefers-color-scheme: dark)')
  media.addEventListener('change', onChange)
  applyThemeClass()
})
onUnmounted(() => {
  media?.removeEventListener('change', onChange)
})
</script>

<template>
  <div class="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden text-[13px]">
    <div class="p-3 border-b border-zinc-100 flex items-center justify-between">
      <div class="flex flex-col gap-0.5">
        <span class="text-zinc-700">外观</span>
        <span class="text-[11px] text-zinc-400">实验性暗色模式，如有显示问题请切回亮色并反馈</span>
      </div>
      <div class="flex p-0.5 bg-zinc-100 border border-zinc-200 rounded-[9px]">
        <button
          v-for="opt in options"
          :key="opt.key"
          class="flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-[7px] transition-all"
          :class="theme === opt.key ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-500 hover:text-zinc-700'"
          @click="theme = opt.key"
        >
          <component :is="opt.icon" class="w-3 h-3" />
          {{ opt.label }}
        </button>
      </div>
    </div>
  </div>
</template>
