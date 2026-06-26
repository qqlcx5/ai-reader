<script lang="ts" setup>
import { AlertDialogRoot, AlertDialogPortal, AlertDialogOverlay, AlertDialogContent, AlertDialogTitle, AlertDialogDescription, AlertDialogCancel, AlertDialogAction } from 'reka-ui'
defineProps<{
  title: string
  desc: string
}>()

defineEmits<{
  cancel: []
  confirm: []
}>()
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
        <AlertDialogTitle class="text-16px font-bold tracking-tight">{{ title }}</AlertDialogTitle>
        <AlertDialogDescription class="mt-2 text-12px text-#6e6e73 leading-relaxed">
          {{ desc }}
        </AlertDialogDescription>
        <div class="mt-4 grid grid-cols-2 gap-2">
          <AlertDialogCancel as-child>
            <button
              class="h-38px rounded-14px border border-rgba(29,29,31,0.08) bg-white/72 text-#3f3f46 text-13px font-semibold cursor-pointer transition-all hover:bg-white hover:-translate-y-px"
              @click="$emit('cancel')"
            >
              取消
            </button>
          </AlertDialogCancel>
          <AlertDialogAction as-child>
            <button
              class="h-38px rounded-14px bg-#dc2626 text-white text-13px font-bold cursor-pointer"
              @click="$emit('confirm')"
            >
              确认删除
            </button>
          </AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialogPortal>
  </AlertDialogRoot>
</template>
