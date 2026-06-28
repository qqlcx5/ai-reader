<script lang="ts" setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useDocumentStore } from '@/stores/document.store'

const documentStore = useDocumentStore()
const gridRef = ref<HTMLElement | null>(null)
const tooltipRef = ref<HTMLElement | null>(null)
const tooltipText = ref('')
const isReady = ref(false)

const colors = ['bg-zinc-100', 'bg-emerald-200', 'bg-emerald-400', 'bg-emerald-600']
const cols = 30
const rows = 7
const totalCells = cols * rows // 210 cells = 210 days ≈ 7 months

function getDateKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function buildCountMap(): Map<string, number> {
  const map = new Map<string, number>()
  for (const doc of documentStore.documents) {
    if (!doc.capturedAt) continue
    const key = getDateKey(new Date(doc.capturedAt))
    map.set(key, (map.get(key) || 0) + 1)
  }
  return map
}

function intensityFromCount(count: number): number {
  if (count === 0) return 0
  if (count <= 2) return 1
  if (count <= 5) return 2
  return 3
}

function buildHeatmap() {
  const grid = gridRef.value
  if (!grid || grid.children.length > 0) return

  const countMap = buildCountMap()
  const today = new Date()
  // End date is today truncated to start of day
  const endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const startDate = new Date(endDate)
  startDate.setDate(startDate.getDate() - totalCells + 1)

  const dateLabels: string[] = []
  const dayCounts: number[] = []
  for (let i = 0; i < totalCells; i++) {
    const d = new Date(startDate)
    d.setDate(d.getDate() + i)
    const key = getDateKey(d)
    dateLabels.push(key)
    dayCounts.push(countMap.get(key) || 0)
  }

  for (let cellIdx = 0; cellIdx < totalCells; cellIdx++) {
    const count = dayCounts[cellIdx]
    const intensity = intensityFromCount(count)
    const dateKey = dateLabels[cellIdx]

    const square = document.createElement('div')
    square.className = `${colors[intensity]} hover:scale-125 transition-transform cursor-crosshair`
    square.style.cssText = 'width:9px;height:9px;border-radius:2px;flex-shrink:0'

    square.addEventListener('mouseenter', (e) => {
      const rect = square.getBoundingClientRect()
      tooltipText.value = count === 0
        ? `无捕获 — 这一天没有新增知识`
        : `捕获 ${count} 篇`
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

// Watch documents to rebuild heatmap when data changes
watch(
  () => documentStore.documents.length,
  () => {
    if (isReady.value) {
      const grid = gridRef.value
      if (grid) {
        while (grid.firstChild) grid.removeChild(grid.firstChild)
        buildHeatmap()
      }
    }
  },
)

onMounted(async () => {
  // Ensure documents are loaded
  if (documentStore.documents.length === 0) {
    await documentStore.refreshDocuments()
  }
  buildHeatmap()
  isReady.value = true
})
</script>

<template>
  <div class="px-4 border-b border-zinc-100">
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
