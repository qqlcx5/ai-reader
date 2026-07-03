<script lang="ts" setup>
import { computed } from 'vue'
import {
  AlertDialogRoot,
  AlertDialogPortal,
  AlertDialogOverlay,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
  AlertDialogAction,
} from 'reka-ui'
import { AlertTriangle, Info } from '@lucide/vue'

const props = withDefaults(
  defineProps<{
    title: string
    desc: string
    confirmText?: string
    cancelText?: string
    /** Destructive action: red confirm button + warning icon. */
    danger?: boolean
  }>(),
  {
    confirmText: '确认',
    cancelText: '取消',
    danger: false,
  },
)

defineEmits<{
  cancel: []
  confirm: []
}>()

const icon = computed(() => (props.danger ? AlertTriangle : Info))
</script>

<template>
  <AlertDialogRoot :open="true">
    <AlertDialogPortal>
      <AlertDialogOverlay
        class="fixed inset-0 z-30"
        style="background: rgba(244,244,245,0.58); backdrop-filter: blur(16px)"
      />
      <AlertDialogContent
        class="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm px-4 py-4 rounded-24px z-40 outline-none"
        style="border: 1px solid rgba(29,29,31,0.08); background: rgba(255,255,255,0.92); box-shadow: 0 24px 70px rgba(0,0,0,0.16)"
      >
        <div class="flex items-center gap-2">
          <component
            :is="icon"
            class="w-4 h-4 shrink-0"
            :class="danger ? 'text-red-500' : 'text-brand'"
          />
          <AlertDialogTitle class="text-16px font-bold tracking-tight m-0">{{ title }}</AlertDialogTitle>
        </div>
        <AlertDialogDescription class="mt-2 mb-0 text-12px text-#6e6e73 leading-relaxed">
          {{ desc }}
        </AlertDialogDescription>
        <div class="mt-4 grid grid-cols-2 gap-2">
          <AlertDialogCancel as-child>
            <button
              class="h-38px rounded-14px border border-zinc-200 bg-zinc-100 text-zinc-800 text-13px font-semibold cursor-pointer transition-all hover:bg-zinc-200 hover:-translate-y-px"
              @click="$emit('cancel')"
            >
              {{ cancelText }}
            </button>
          </AlertDialogCancel>
          <AlertDialogAction as-child>
            <button
              :class="[
                'h-38px rounded-14px text-white text-13px font-bold cursor-pointer transition-all hover:-translate-y-px',
                danger ? 'bg-#dc2626 hover:bg-#b91c1c' : 'bg-brand hover:bg-brand/90',
              ]"
              @click="$emit('confirm')"
            >
              {{ confirmText }}
            </button>
          </AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialogPortal>
  </AlertDialogRoot>
</template>
