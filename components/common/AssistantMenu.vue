<script lang="ts" setup>
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { ChevronRight } from '@lucide/vue'
import LogoMark from '@/components/common/LogoMark.vue'

export interface AssistantMenuItem {
  key: string
  label: string
  description?: string
  icon?: Component
  disabled?: boolean
  loading?: boolean
  hidden?: boolean
}

import { type Component } from 'vue'

const props = withDefaults(defineProps<{
  items: AssistantMenuItem[]
  /** Edge the trigger sits on, decides which side the card opens. */
  side?: 'left' | 'right' | 'top' | 'bottom'
  triggerSize?: number
}>(), {
  side: 'right',
  triggerSize: 44,
})

const emit = defineEmits<{ select: [item: AssistantMenuItem] }>()
const open = ref(false)
const root = ref<HTMLElement | null>(null)
let closeTimer: ReturnType<typeof setTimeout> | null = null

const visibleItems = computed(() => props.items.filter((i) => !i.hidden))
const primary = computed(() => visibleItems.value[0])
const rest = computed(() => visibleItems.value.slice(1))

// Card opens toward the screen centre (away from the edge it's docked on).
const cardSideClass = computed(() => {
  switch (props.side) {
    case 'left': return 'left-full ml-3 top-1/2 -translate-y-1/2'
    case 'top': return 'top-full mt-3 left-1/2 -translate-x-1/2'
    case 'bottom': return 'bottom-full mb-3 left-1/2 -translate-x-1/2'
    default: return 'right-full mr-3 top-1/2 -translate-y-1/2'
  }
})

function show() {
  if (closeTimer) { clearTimeout(closeTimer); closeTimer = null }
  open.value = true
}
function hide() { closeTimer = setTimeout(() => { open.value = false }, 180) }
function toggle() { open.value = !open.value }
function pick(item: AssistantMenuItem) {
  if (item.disabled || item.loading) return
  emit('select', item)
  open.value = false
}
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') { open.value = false; root.value?.querySelector<HTMLElement>('[data-assistant-trigger]')?.focus() }
}
function onOutside(e: MouseEvent) {
  if (open.value && root.value && !root.value.contains(e.target as Node)) open.value = false
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
  <div ref="root" class="relative" @mouseenter="show" @mouseleave="hide">
    <!-- Trigger ball -->
    <button
      type="button"
      data-assistant-trigger data-floating-trigger
      aria-label="AuraMind 助手"
      :aria-expanded="open"
      class="glass soft-shadow flex items-center justify-center rounded-full text-brand transition-all hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
      :style="{ width: `${triggerSize}px`, height: `${triggerSize}px` }"
      @click.stop="toggle"
    >
      <LogoMark :size="Math.round(triggerSize * 0.55)" />
    </button>

    <!-- Card menu -->
    <Transition name="assistant-menu">
      <div
        v-if="open"
        :class="['glass soft-shadow absolute z-50 w-60 rounded-2xl p-1.5', cardSideClass]"
      >
        <!-- Primary action (full-width brand row) -->
        <button
          v-if="primary"
          type="button"
          :disabled="primary.disabled || primary.loading"
          class="group flex w-full items-center gap-2.5 rounded-xl bg-brand px-3 py-2.5 text-left text-white transition-colors hover:bg-brand/90 disabled:opacity-50 disabled:cursor-not-allowed"
          @click="pick(primary)"
        >
          <component
            :is="primary.icon"
            v-if="primary.icon"
            class="h-4 w-4 shrink-0"
            :class="{ 'animate-spin': primary.loading }"
          />
          <div class="min-w-0 flex-1">
            <div class="text-[13px] font-medium leading-tight">{{ primary.label }}</div>
            <div v-if="primary.description" class="text-[11px] text-white/70 truncate">{{ primary.description }}</div>
          </div>
          <ChevronRight class="h-3.5 w-3.5 opacity-70 transition-transform group-hover:translate-x-0.5" />
        </button>

        <!-- Secondary actions -->
        <div v-if="rest.length" class="mt-1 space-y-0.5">
          <button
            v-for="item in rest"
            :key="item.key"
            type="button"
            :disabled="item.disabled || item.loading"
            :title="item.description || item.label"
            class="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-zinc-700 transition-colors hover:bg-zinc-100 disabled:opacity-40 disabled:cursor-not-allowed"
            @click="pick(item)"
          >
            <component
              :is="item.icon"
              v-if="item.icon"
              class="h-3.5 w-3.5 shrink-0 text-zinc-500"
              :class="{ 'animate-spin': item.loading }"
            />
            <span class="text-[13px] leading-tight">{{ item.label }}</span>
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.assistant-menu-enter-active,
.assistant-menu-leave-active {
  transition: opacity .16s ease, transform .16s ease;
}
.assistant-menu-enter-from,
.assistant-menu-leave-to {
  opacity: 0;
  transform: scale(.92);
}
@media (prefers-reduced-motion: reduce) {
  .assistant-menu-enter-active, .assistant-menu-leave-active { transition: none; }
}
</style>
