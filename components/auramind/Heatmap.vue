<script lang="ts" setup>
import dayjs, { type Dayjs } from 'dayjs'
import { computed, ref, onMounted } from 'vue'
import { useDocumentStore } from '@/stores/document.store'

const documentStore = useDocumentStore()
const scrollRef = ref<HTMLElement | null>(null)

const props = defineProps<{
  selectedKey?: string | null
}>()
const emit = defineEmits<{
  select: [key: string]
}>()

// GitHub contribution graph: 53 weeks, Mon-start weeks, 5-level green scale.
const WEEKS = 53
const CELL = 11
const GAP = 3
const STEP = CELL + GAP
const WEEKDAY_COL = 24

const LEVEL_CLASS = [
  'bg-[#ebedf0]',
  'bg-[#9be9a8]',
  'bg-[#40c463]',
  'bg-[#30a14e]',
  'bg-[#216e39]',
]

const MONTH_LABELS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']
const WEEKDAY_ROWS = [
  { label: '一', show: true },
  { label: '二', show: false },
  { label: '三', show: true },
  { label: '四', show: false },
  { label: '五', show: true },
  { label: '六', show: false },
  { label: '日', show: false },
]

const dateKey = (date: dayjs.ConfigType) => dayjs(date).format('YYYY-MM-DD')
function levelFor(count: number) {
  if (count <= 0) return 0
  if (count <= 2) return 1
  if (count <= 4) return 2
  if (count <= 7) return 3
  return 4
}

const countMap = computed(() => {
  const m = new Map<string, number>()
  for (const doc of documentStore.documents) {
    if (!doc.capturedAt) continue
    const key = dateKey(doc.capturedAt)
    m.set(key, (m.get(key) || 0) + 1)
  }
  return m
})

const today = dayjs().startOf('day')
const todayDow = (today.day() + 6) % 7 // Mon=0 … Sun=6
const startDate = today.subtract(todayDow + (WEEKS - 1) * 7, 'day')

interface Cell {
  key: string
  date: Dayjs
  count: number
  level: number
  future: boolean
}

const cells = computed<Cell[]>(() => {
  const cm = countMap.value
  const out: Cell[] = []
  for (let c = 0; c < WEEKS; c++) {
    for (let r = 0; r < 7; r++) {
      const d = startDate.add(c * 7 + r, 'day')
      const future = d.isAfter(today)
      const count = future ? 0 : cm.get(dateKey(d)) || 0
      out.push({ key: dateKey(d), date: d, count, level: levelFor(count), future })
    }
  }
  return out
})

const monthLabels = computed(() => {
  const labels: { label: string; col: number }[] = []
  let prev = -1
  for (let c = 0; c < WEEKS; c++) {
    const d = startDate.add(c * 7, 'day')
    const m = d.month()
    if (m !== prev) {
      labels.push({ label: MONTH_LABELS[m], col: c })
      prev = m
    }
  }
  return labels
})

const yearTotal = computed(() => cells.value.reduce((sum, c) => sum + c.count, 0))
const gridWidth = WEEKS * STEP - GAP

const tooltip = ref<{ x: number; y: number; text: string } | null>(null)

function onCellEnter(e: MouseEvent, cell: Cell) {
  const target = e.currentTarget as HTMLElement
  const rect = target.getBoundingClientRect()
  const dateLabel = cell.date.format('M月D日')
  tooltip.value = {
    x: rect.left + rect.width / 2,
    y: rect.top,
    text: cell.future || cell.count === 0 ? `0 篇捕获 · ${dateLabel}` : `${cell.count} 篇捕获 · ${dateLabel}`,
  }
}
function onCellLeave() {
  tooltip.value = null
}

function onCellClick(cell: Cell) {
  if (cell.future) return
  emit('select', cell.key)
}

onMounted(async () => {
  if (documentStore.documents.length === 0) {
    await documentStore.refreshDocuments()
  }
  // Anchor to the most recent week (right edge), like GitHub.
  requestAnimationFrame(() => {
    if (scrollRef.value) scrollRef.value.scrollLeft = scrollRef.value.scrollWidth
  })
})
</script>

<template>
  <div class="px-4 py-3 border-b border-zinc-100">
    <div class="flex items-center justify-between mb-3">
      <h3 class="text-[12px] font-medium flex items-center gap-1.5">
        <svg class="w-3.5 h-3.5 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
        知识捕获轨迹
      </h3>
      <span class="text-[11px] text-zinc-400">过去一年 {{ yearTotal }} 篇</span>
    </div>

    <div ref="scrollRef" class="overflow-x-auto no-scrollbar pb-1">
      <div :style="{ width: `${WEEKDAY_COL + GAP + gridWidth}px` }">
        <!-- Month labels row -->
        <div class="flex mb-[3px]" style="height: 14px">
          <div :style="{ width: `${WEEKDAY_COL + GAP}px` }" />
          <div class="relative" :style="{ width: `${gridWidth}px` }">
            <span
              v-for="m in monthLabels"
              :key="m.col"
              class="absolute text-[10px] text-zinc-500 whitespace-nowrap"
              :style="{ left: `${m.col * STEP}px` }"
            >{{ m.label }}</span>
          </div>
        </div>

        <!-- Weekday labels + grid -->
        <div class="flex">
          <div class="flex flex-col" :style="{ gap: `${GAP}px`, width: `${WEEKDAY_COL}px`, marginRight: `${GAP}px` }">
            <div
              v-for="(w, i) in WEEKDAY_ROWS"
              :key="i"
              class="text-[9px] text-zinc-400 leading-none flex items-center"
              :style="{ height: `${CELL}px` }"
            >{{ w.show ? w.label : '' }}</div>
          </div>

          <div
            class="grid grid-rows-7 grid-flow-col"
            :style="{ gap: `${GAP}px`, width: `${gridWidth}px` }"
          >
            <div
              v-for="cell in cells"
              :key="cell.key"
              :class="[
                LEVEL_CLASS[cell.level],
                'rounded-[2px] transition-transform',
                cell.future ? 'opacity-40 cursor-default' : 'cursor-pointer hover:scale-125',
                cell.key === props.selectedKey ? 'ring-2 ring-zinc-800 ring-offset-1 ring-offset-[#FCFCFC]' : '',
              ]"
              :style="{ width: `${CELL}px`, height: `${CELL}px` }"
              @mouseenter="onCellEnter($event, cell)"
              @mouseleave="onCellLeave"
              @click="onCellClick(cell)"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Legend -->
    <div class="flex justify-end items-center gap-1.5 mt-2 text-[10px] text-zinc-400">
      <span>少</span>
      <div
        v-for="(cls, i) in LEVEL_CLASS"
        :key="i"
        class="rounded-[2px]"
        :class="cls"
        style="width: 10px; height: 10px"
      />
      <span>多</span>
    </div>

    <!-- Tooltip -->
    <div
      v-if="tooltip"
      class="fixed pointer-events-none bg-zinc-900 text-white text-[11px] px-2.5 py-1.5 rounded-md shadow-lg z-50 whitespace-nowrap -translate-x-1/2 -translate-y-full"
      :style="{ left: `${tooltip.x}px`, top: `${tooltip.y - 8}px` }"
    >{{ tooltip.text }}</div>
  </div>
</template>
