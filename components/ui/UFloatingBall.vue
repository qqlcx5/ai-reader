<script lang="ts" setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'

interface SavedPosition {
  edge: 'left' | 'right' | 'top' | 'bottom'
  offset: number
}

const props = withDefaults(defineProps<{
  storageKey?: string
  size?: number
}>(), { storageKey: 'auramind-floating-ball', size: 44 })

const edge = ref<SavedPosition['edge']>('right')
const offset = ref(0.5)
const dragging = ref(false)
const moved = ref(false)
const start = ref({ x: 0, y: 0 })
const root = ref<HTMLElement | null>(null)

const style = computed(() => {
  const gap = '12px'
  const position: Record<string, string> = { width: `${props.size}px`, height: `${props.size}px` }
  if (edge.value === 'left' || edge.value === 'right') {
    position.top = `${offset.value * 100}%`
    position[edge.value] = gap
    position.transform = 'translateY(-50%)'
  } else {
    position.left = `${offset.value * 100}%`
    position[edge.value] = gap
    position.transform = 'translateX(-50%)'
  }
  return position
})

function clamp(value: number) { return Math.max(0.08, Math.min(0.92, value)) }
function save() {
  localStorage.setItem(props.storageKey, JSON.stringify({ edge: edge.value, offset: offset.value }))
}
function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(props.storageKey) || '') as SavedPosition
    if (['left', 'right', 'top', 'bottom'].includes(saved.edge)) edge.value = saved.edge
    if (typeof saved.offset === 'number') offset.value = clamp(saved.offset)
  } catch { /* no saved position */ }
}
function move(event: PointerEvent) {
  if (!dragging.value) return
  const dx = event.clientX - start.value.x
  const dy = event.clientY - start.value.y
  moved.value ||= Math.hypot(dx, dy) > 6
  const width = window.innerWidth
  const height = window.innerHeight
  const distances = [
    { edge: 'left' as const, value: event.clientX },
    { edge: 'right' as const, value: width - event.clientX },
    { edge: 'top' as const, value: event.clientY },
    { edge: 'bottom' as const, value: height - event.clientY },
  ]
  edge.value = distances.sort((a, b) => a.value - b.value)[0].edge
  offset.value = clamp(edge.value === 'left' || edge.value === 'right'
    ? event.clientY / height
    : event.clientX / width)
}
function end() {
  if (!dragging.value) return
  dragging.value = false
  save()
  window.removeEventListener('pointermove', move)
  window.removeEventListener('pointerup', end)
  window.removeEventListener('blur', end)
}
function startDrag(event: PointerEvent) {
  if (event.button !== 0) return
  dragging.value = true
  moved.value = false
  start.value = { x: event.clientX, y: event.clientY }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', end)
  window.addEventListener('blur', end)
}
function suppressClick(event: MouseEvent) {
  if (moved.value) {
    event.preventDefault()
    event.stopPropagation()
    moved.value = false
  }
}
function reposition() { offset.value = clamp(offset.value) }
onMounted(() => { load(); window.addEventListener('resize', reposition) })
onUnmounted(() => { end(); window.removeEventListener('resize', reposition) })
</script>

<template>
  <div
    ref="root"
    class="fixed z-[2147483647] select-none pointer-events-auto"
    :style="{ position: 'fixed', zIndex: 2147483647, ...style }"
    @pointerdown="startDrag"
    @click.capture="suppressClick"
  >
    <slot />
  </div>
</template>
