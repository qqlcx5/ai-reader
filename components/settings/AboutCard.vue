<script lang="ts" setup>
import { computed } from 'vue'
import { Info, Code2, Keyboard } from '@lucide/vue'

const version = computed(() => {
  try {
    return (globalThis as any).browser?.runtime?.getManifest?.()?.version || '0.2.0'
  } catch {
    return '0.2.0'
  }
})
</script>

<template>
  <div class="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden text-[13px]">
    <div class="p-3 border-b border-zinc-100 flex items-center gap-2">
      <Info class="w-4 h-4 text-zinc-400" />
      <span class="text-zinc-700">关于 AuraMind</span>
      <span class="ml-auto text-[11px] text-zinc-400 font-mono">v{{ version }}</span>
    </div>
    <div class="p-3 flex flex-col gap-2 text-[11px] text-zinc-500">
      <div class="flex items-center gap-1.5">
        <Code2 class="w-3 h-3" />
        开源（MIT）· 本地优先 · 无追踪
      </div>
      <div class="flex items-center gap-1.5">
        <Keyboard class="w-3 h-3" />
        快捷键：<kbd class="px-1 border border-zinc-200 rounded">Ctrl K</kbd> 命令面板 ·
        <kbd class="px-1 border border-zinc-200 rounded">?</kbd> 速查表
      </div>
      <div>更新日志见仓库 <code class="text-zinc-600">CHANGELOG.md</code></div>
    </div>
  </div>
</template>
