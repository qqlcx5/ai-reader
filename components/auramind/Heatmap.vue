<script lang="ts" setup>
import { ref, onMounted } from 'vue'

const gridRef = ref<HTMLElement | null>(null)
const tooltipRef = ref<HTMLElement | null>(null)
const tooltipText = ref('')

const colors = ['bg-zinc-100', 'bg-emerald-200', 'bg-emerald-400', 'bg-emerald-600']
const cols = 30
const rows = 7

function buildHeatmap() {
  const grid = gridRef.value
  if (!grid || grid.children.length > 0) return

  for (let i = 0; i < cols * rows; i++) {
    const square = document.createElement('div')
    const rand = Math.random()
    let intensity = 0
    if (rand > 0.55) intensity = 1
    if (rand > 0.82) intensity = 2
    if (rand > 0.94) intensity = 3

    square.className = `${colors[intensity]} hover:scale-125 transition-transform cursor-crosshair`
    square.style.cssText = 'width:9px;height:9px;border-radius:2px;flex-shrink:0'

    square.addEventListener('mouseenter', (e) => {
      const rect = square.getBoundingClientRect()
      const captures = intensity === 0 ? 0 : intensity * 3 + Math.floor(Math.random() * 3)
      const chats = intensity === 0 ? 0 : intensity * 2
      tooltipText.value = intensity === 0
        ? '无捕获 — 这一天没有新增知识'
        : `捕获 ${captures} 篇 · AI 对话 ${chats} 次`

      const tip = tooltipRef.value
      if (tip) {
        tip.style.left = `${rect.left + rect.width / 2}px`
        tip.style.top = `${rect.top - 8}px`
        tip.classList.remove('hidden', 'opacity-0')
      }
    })

    square.addEventListener('mouseleave', () => {
      const tip = tooltipRef.value
      if (tip) {
        tip.classList.add('opacity-0')
        setTimeout(() => tip.classList.add('hidden'), 150)
      }
    })

    grid.appendChild(square)
  }

  const scroll = grid.parentElement
  if (scroll) {
    setTimeout(() => { scroll.scrollLeft = scroll.scrollWidth }, 0)
  }
}

onMounted(buildHeatmap)
</script>

<template>
  <div class="px-4 py-5 border-b border-zinc-100">
    <div class="flex items-center justify-between mb-3">
      <h3 class="text-[12px] font-medium flex items-center gap-1.5">
        <svg class="w-3.5 h-3.5 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
        知识捕获轨迹
      </h3>
      <span class="text-[11px] text-zinc-400">近 6 个月</span>
    </div>

    <div class="overflow-x-auto no-scrollbar cursor-grab active:cursor-grabbing pb-1">
      <div ref="gridRef" class="grid grid-rows-7 grid-flow-col gap-[3px] w-max" />
    </div>

    <div class="flex justify-end items-center gap-1.5 mt-2 text-[10px] text-zinc-400">
      <span>少</span>
      <div class="w-2.5 h-2.5 rounded-[2px] bg-zinc-100" />
      <div class="w-2.5 h-2.5 rounded-[2px] bg-emerald-200" />
      <div class="w-2.5 h-2.5 rounded-[2px] bg-emerald-400" />
      <div class="w-2.5 h-2.5 rounded-[2px] bg-emerald-600" />
      <span>多</span>
    </div>

    <!-- Tooltip -->
    <div
      ref="tooltipRef"
      class="fixed hidden opacity-0 pointer-events-none bg-zinc-900 text-white text-[11px] px-2.5 py-1.5 rounded-md shadow-lg z-50 whitespace-nowrap transition-opacity duration-150 -translate-x-1/2 -translate-y-full"
    >
      {{ tooltipText }}
    </div>
  </div>
</template>
