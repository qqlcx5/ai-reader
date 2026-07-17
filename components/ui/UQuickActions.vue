<script lang="ts" setup>
import { ref, computed, onMounted, onUnmounted, type Component } from 'vue'
import UButton from './UButton.vue'

export interface QuickActionItem {
  key: string
  label: string
  description?: string
  icon?: Component
  disabled?: boolean
  loading?: boolean
  hidden?: boolean
  danger?: boolean
}

const props = withDefaults(defineProps<{
  items: QuickActionItem[]
  position?: 'top' | 'right' | 'bottom' | 'left'
  direction?: 'horizontal' | 'vertical'
  floating?: boolean
  side?: 'left' | 'right' | 'top' | 'bottom'
}>(), {
  position: 'right',
  direction: 'vertical',
  floating: true,
  side: 'right',
})

const emit = defineEmits<{ select: [item: QuickActionItem] }>()
const expanded = ref(false)
const locked = ref(false)
const root = ref<HTMLElement | null>(null)
let closeTimer: ReturnType<typeof setTimeout> | null = null
const visibleItems = () => props.items.filter((item) => !item.hidden)
const arcAngles = computed(() => {
  const count = visibleItems().length
  const start = props.side === 'left' ? -60 : props.side === 'top' ? 30 : props.side === 'bottom' ? 210 : 120
  const span = props.side === 'top' || props.side === 'bottom' ? 120 : 120
  return visibleItems().map((_, index) => count === 1 ? start + span / 2 : start + (span / (count - 1)) * index)
})

function toggle() {
  locked.value = !locked.value
  expanded.value = locked.value
}
function close() {
  locked.value = false
  expanded.value = false
}
function open() {
  if (closeTimer) clearTimeout(closeTimer)
  expanded.value = true
}
function scheduleClose() {
  if (locked.value) return
  closeTimer = setTimeout(() => { expanded.value = false }, 220)
}
function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    close()
    ;(root.value?.querySelector('[data-quick-trigger]') as HTMLElement | null)?.focus()
  }
}
function onOutside(event: MouseEvent) {
  if (expanded.value && root.value && !root.value.contains(event.target as Node)) close()
}
onMounted(() => {
  document.addEventListener('keydown', onKeydown)
  document.addEventListener('click', onOutside)
})
onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown)
  document.removeEventListener('click', onOutside)
  if (closeTimer) clearTimeout(closeTimer)
})
</script>

<template>
  <div ref="root" :class="[props.floating ? 'fixed z-40' : 'relative']" @mouseenter="open" @mouseleave="scheduleClose">
    <div class="relative h-10 w-10 overflow-visible">
      <TransitionGroup name="quick-action" tag="div">
        <slot v-for="(item, index) in visibleItems()" name="item" :item="item">
          <UButton
            v-show="expanded"
            :key="item.key"
            :disabled="item.disabled || item.loading"
            :variant="item.danger ? 'danger' : 'secondary'"
            size="sm"
            class="absolute left-1/2 top-1/2 h-10 w-10 min-h-10 -translate-x-1/2 -translate-y-1/2 rounded-full p-0 shadow-md"
            :style="{ transform: `translate(-50%, -50%) translate(${Math.cos(arcAngles[index] * Math.PI / 180) * 76}px, ${Math.sin(arcAngles[index] * Math.PI / 180) * 76}px)`, opacity: expanded ? 1 : 0, pointerEvents: expanded ? 'auto' : 'none' }"
            :aria-label="item.label"
            :title="item.description || item.label"
            @click.stop="emit('select', item); close()"
          >
            <component :is="item.icon" v-if="item.icon" class="h-3.5 w-3.5" :class="{ 'animate-spin': item.loading }" />
          </UButton>
        </slot>
      </TransitionGroup>
      <button
        type="button"
        data-quick-trigger data-floating-trigger
        aria-label="快捷操作"
        :aria-expanded="expanded"
        class="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 bg-white text-brand shadow-lg transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
        @click.stop="toggle"
      >
        <slot name="trigger">✦</slot>
      </button>
    </div>
  </div>
</template>

<style scoped>
.quick-action-enter-active, .quick-action-leave-active { transition: all .16s ease; }
.quick-action-enter-from, .quick-action-leave-to { opacity: 0; transform: scale(.8); }
@media (prefers-reduced-motion: reduce) { .quick-action-enter-active, .quick-action-leave-active { transition: none; } }
</style>
