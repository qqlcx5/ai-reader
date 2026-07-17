<script lang="ts" setup>
import { ref, onMounted, onUnmounted, type Component } from 'vue'
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
}>(), {
  position: 'right',
  direction: 'vertical',
  floating: true,
})

const emit = defineEmits<{ select: [item: QuickActionItem] }>()
const expanded = ref(false)
const locked = ref(false)
const root = ref<HTMLElement | null>(null)
const visibleItems = () => props.items.filter((item) => !item.hidden)

function toggle() {
  locked.value = !locked.value
  expanded.value = locked.value
}
function close() {
  locked.value = false
  expanded.value = false
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
})
</script>

<template>
  <div ref="root" :class="[props.floating ? 'fixed z-40' : 'relative', {
    'top-1/2 right-3 -translate-y-1/2': props.position === 'right',
    'top-1/2 left-3 -translate-y-1/2': props.position === 'left',
    'top-3 left-1/2 -translate-x-1/2': props.position === 'top',
    'bottom-3 left-1/2 -translate-x-1/2': props.position === 'bottom',
  }]" @mouseenter="expanded = true" @mouseleave="expanded = locked">
    <div class="flex items-center gap-2" :class="direction === 'vertical' ? 'flex-col' : 'flex-row'">
      <TransitionGroup name="quick-action" tag="div" class="flex items-center gap-2" :class="direction === 'vertical' ? 'flex-col' : 'flex-row'">
        <slot v-for="item in visibleItems()" name="item" :item="item">
          <UButton
            v-show="expanded"
            :key="item.key"
            :disabled="item.disabled || item.loading"
            :variant="item.danger ? 'danger' : 'secondary'"
            size="sm"
            class="min-h-8 whitespace-nowrap shadow-md"
            :title="item.description || item.label"
            @click="emit('select', item); close()"
          >
            <component :is="item.icon" v-if="item.icon" class="h-3.5 w-3.5" :class="{ 'animate-spin': item.loading }" />
            <span>{{ item.loading ? '处理中...' : item.label }}</span>
          </UButton>
        </slot>
      </TransitionGroup>
      <button
        type="button"
        data-quick-trigger
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
