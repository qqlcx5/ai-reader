<script lang="ts" setup>
import {
  DialogRoot,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from 'reka-ui'

const props = withDefaults(defineProps<{
  open: boolean
  title?: string
  description?: string
  contentClass?: string
  position?: 'top' | 'right' | 'bottom' | 'left' | 'center'
}>(), {
  title: undefined,
  description: undefined,
  contentClass: '',
  position: 'center',
})

const positionClass = {
  top: 'inset-x-0 top-0 w-full rounded-b-2xl border-b',
  right: 'right-0 inset-y-0 h-full w-[min(420px,calc(100vw-32px))] rounded-l-2xl border-l',
  bottom: 'inset-x-0 bottom-0 w-full rounded-t-2xl border-t',
  left: 'left-0 inset-y-0 h-full w-[min(420px,calc(100vw-32px))] rounded-r-2xl border-r',
  center: 'left-1/2 top-1/2 w-[min(640px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 rounded-2xl border',
} as const

const emit = defineEmits<{
  close: []
}>()
</script>

<template>
  <DialogRoot :open="open" @update:open="(value) => { if (!value) emit('close') }">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm" @click="emit('close')" />
      <DialogContent
        :class="[
          'fixed z-50 flex max-h-[85vh] flex-col border-zinc-200 bg-white shadow-2xl outline-none',
          positionClass[props.position],
          contentClass,
        ]"
      >
        <slot name="header">
          <DialogTitle v-if="title" class="text-[15px] font-semibold">{{ title }}</DialogTitle>
          <DialogDescription v-if="description" class="text-[11px] text-zinc-400">{{ description }}</DialogDescription>
        </slot>
        <slot />
        <slot name="footer" />
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
