<script setup lang="ts">
import {
  DialogRoot,
  DialogTrigger,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from 'reka-ui'
import { X } from '@lucide/vue'

defineProps<{
  title?: string
  description?: string
}>()

const open = defineModel<boolean>('open', { default: false })
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogTrigger as-child>
      <slot name="trigger" />
    </DialogTrigger>

    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=open]:fade-in data-[state=closed]:animate-out data-[state=closed]:fade-out" />

      <DialogContent
        class="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6 w-[90vw] max-w-md max-h-[85vh] overflow-y-auto focus:outline-none data-[state=open]:animate-in data-[state=open]:fade-in data-[state=open]:zoom-in-95 data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=closed]:zoom-out-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]"
      >
        <div v-if="title" class="flex items-center justify-between mb-4">
          <div>
            <DialogTitle class="text-base font-semibold text-slate-800 dark:text-slate-200">
              {{ title }}
            </DialogTitle>
            <DialogDescription
              v-if="description"
              class="mt-1 text-sm text-slate-500 dark:text-slate-400"
            >
              {{ description }}
            </DialogDescription>
          </div>
          <DialogClose
            class="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            aria-label="Close"
          >
            <X class="w-4 h-4" />
          </DialogClose>
        </div>

        <slot />
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
