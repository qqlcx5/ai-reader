<script lang="ts" setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useDocumentStore } from '@/stores/document.store'

const documentStore = useDocumentStore()
const gridRef = ref<HTMLElement | null>(null)
const scrollRef = ref<HTMLElement | null>(null)
const weekdayRef = ref<HTMLElement | null>(null)
const monthRef = ref<HTMLElement | null>(null)
const tooltipRef = ref<HTMLElement | null>(null)
const tooltipText = ref('')
const isReady = ref(false)

const colors = ['bg-zinc-100', 'bg-emerald-200', 'bg-emerald-400', 'bg-emerald-600']
const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日']
const rows = 7
const cellSize = 9
const gridGap = 3
const weekdayLabelWidth = 28
const cols = ref(30)
const totalCells = computed(() => cols.value * rows)

let observer: ResizeObserver | null = null
let rafId: number | null = null

function updateCols() {
  const scroll = scrollRef.value
  if (!scroll) return
  const newCols = Math.max(1, Math.floor((scroll.clientWidth - weekdayLabelWidth + gridGap) / (cellSize + gridGap)))
  if (newCols !== cols.value) {
    cols.value = newCols
  }
}

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
  const endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const startDate = new Date(endDate)
  startDate.setDate(startDate.getDate() - totalCells.value + 1)

  // ── Weekday labels ──
  const wc = weekdayRef.value
  if (wc) {
    const startDow = startDate.getDay() // 0=Sun
    const startIdx = (startDow + 6) % 7 // 0=Mon in WEEKDAYS

    for (let i = 0; i < rows; i++) {
      const div = document.createElement('div')
      div.style.cssText = 'height:9px;display:flex;align-items:center;justify-content:flex-end'
      const wd = (startIdx + i) % 7
      if (wd === 0 || wd === 2 || wd === 4) {
        div.textContent = WEEKDAYS[wd]
        div.className = 'text-[9px] text-zinc-400'
      }
      wc.appendChild(div)
    }
  }

  // ── Month labels ──
  const mc = monthRef.value
  if (mc) {
    let prevMonth = -1
    let monthStartCol = 0
    const months: { label: string; span: number }[] = []

    for (let week = 0; week < cols.value; week++) {
      const d = new Date(startDate)
      d.setDate(d.getDate() + week * rows)
      const month = d.getMonth()

      if (month !== prevMonth) {
        if (prevMonth >= 0) {
          months.push({ label: `${prevMonth + 1}月`, span: week - monthStartCol })
        }
        prevMonth = month
        monthStartCol = week
      }
    }
    if (prevMonth >= 0) {
      months.push({ label: `${prevMonth + 1}月`, span: cols.value - monthStartCol })
    }

    for (const m of months) {
      const div = document.createElement('div')
      div.textContent = m.label
      div.className = 'text-[10px] text-zinc-500 whitespace-nowrap'
      div.style.width = `${m.span * (cellSize + gridGap) - gridGap}px`
      mc.appendChild(div)
    }
  }

  // ── Cells ──
  const dateLabels: string[] = []
  const dayCounts: number[] = []
  for (let i = 0; i < totalCells.value; i++) {
    const d = new Date(startDate)
    d.setDate(d.getDate() + i)
    const key = getDateKey(d)
    dateLabels.push(key)
    dayCounts.push(countMap.get(key) || 0)
  }

  for (let cellIdx = 0; cellIdx < totalCells.value; cellIdx++) {
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

  const scroll = scrollRef.value
  if (scroll) {
    setTimeout(() => { scroll.scrollLeft = scroll.scrollWidth }, 0)
  }
}

function clearAll() {
  ;[gridRef.value, weekdayRef.value, monthRef.value].forEach((el) => {
    if (el) while (el.firstChild) el.removeChild(el.firstChild)
  })
}

// Rebuild when cols or documents change
watch(
  [() => documentStore.documents.length, cols],
  () => {
    if (isReady.value) {
      clearAll()
      buildHeatmap()
    }
  },
)

onMounted(async () => {
  if (documentStore.documents.length === 0) {
    await documentStore.refreshDocuments()
  }

  if (scrollRef.value) {
    observer = new ResizeObserver(() => {
      if (rafId) cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(() => updateCols())
    })
    observer.observe(scrollRef.value)
  }

  buildHeatmap()
  isReady.value = true
})

onUnmounted(() => {
  observer?.disconnect()
  if (rafId) cancelAnimationFrame(rafId)
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

    <div ref="scrollRef" class="overflow-x-auto no-scrollbar cursor-grab active:cursor-grabbing pb-1">
      <div class="inline-flex w-max">
        <div ref="weekdayRef" class="flex flex-col gap-[3px] shrink-0 mr-[3px]" style="width: 25px" />
        <div>
          <div ref="monthRef" class="flex gap-[3px] mb-[3px]" style="height: 14px" />
          <div ref="gridRef" class="grid grid-rows-7 grid-flow-col gap-[3px]" />
        </div>
      </div>
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
