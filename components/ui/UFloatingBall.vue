<script lang="ts" setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'

export type FloatingEdge = 'left' | 'right' | 'top' | 'bottom'
interface SavedPosition { edge: FloatingEdge; offset: number }

const props = withDefaults(defineProps<{
  storageKey?: string
  size?: number
}>(), { storageKey: 'auramind-floating-ball', size: 44 })

const emit = defineEmits<{ 'update:edge': [edge: FloatingEdge] }>()
const edge = defineModel<FloatingEdge>('edge', { default: 'right' })
const offset = ref(0.5)
const dragging = ref(false)
const moved = ref(false)
const start = ref({ x: 0, y: 0 })
const root = ref<HTMLElement | null>(null)

const style = computed(() => {
  const position: Record<string, string> = {
    position: 'fixed', zIndex: '2147483647',
    width: `${props.size}px`, height: `${props.size}px`,
  }
  if (edge.value === 'left' || edge.value === 'right') {
    position.top = `${offset.value * 100}%`
    position[edge.value] = '12px'
    position.transform = 'translateY(-50%)'
  } else {
    position.left = `${offset.value * 100}%`
    position[edge.value] = '12px'
    position.transform = 'translateX(-50%)'
  }
  return position
})

function clamp(value: number) { return Math.max(0.08, Math.min(0.92, value)) }
function save() { localStorage.setItem(props.storageKey, JSON.stringify({ edge: edge.value, offset: offset.value })) }
function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(props.storageKey) || '') as SavedPosition
    if (['left', 'right', 'top', 'bottom'].includes(saved.edge)) edge.value = saved.edge
    if (typeof saved.offset === 'number') offset.value = clamp(saved.offset)
  } catch { /* first visit */ }
}
function move(event: PointerEvent) {
  if (!dragging.value) return
  const dx = event.clientX - start.value.x
  const dy = event.clientY - start.value.y
  if (!moved.value && Math.hypot(dx, dy) <= 6) return
  moved.value = true
  const width = window.innerWidth
  const height = window.innerHeight
  const candidates = [
    { edge: 'left' as const, distance: event.clientX },
    { edge: 'right' as const, distance: width - event.clientX },
    { edge: 'top' as const, distance: event.clientY },
    { edge: 'bottom' as const, distance: height - event.clientY },
  ]
  const next = candidates.reduce((a, b) => a.distance < b.distance ? a : b)
  edge.value = next.edge
  emit('update:edge', next.edge)
  offset.value = clamp(next.edge === 'left' || next.edge === 'right'
    ? event.clientY / height : event.clientX / width)
}
function end(event?: PointerEvent) {
  if (!dragging.value) return
  dragging.value = false
  if (event && root.value?.hasPointerCapture(event.pointerId)) root.value.releasePointerCapture(event.pointerId)
  save()
}
function startDrag(event: PointerEvent) {
  if (event.button !== 0 || !root.value) return
  if (!(event.target as HTMLElement).closest('[data-floating-trigger]')) return
  dragging.value = true
  moved.value = false
  start.value = { x: event.clientX, y: event.clientY }
  root.value.setPointerCapture(event.pointerId)
}
function suppressClick(event: MouseEvent) {
  if (!moved.value) return
  event.preventDefault()
  event.stopPropagation()
  moved.value = false
}
function reposition() { offset.value = clamp(offset.value) }
onMounted(() => { load(); window.addEventListener('resize', reposition) })
onUnmounted(() => { if (dragging.value) end(); window.removeEventListener('resize', reposition) })
</script>

<template>
  <div
    ref="root"
    class="pointer-events-auto select-none touch-none"
    :style="style"
    @pointerdown="startDrag"
    @pointermove="move"
    @pointerup="end"
    @pointercancel="end"
    @click.capture="suppressClick"
  >
    <slot :edge="edge" />
  </div>
</template>
