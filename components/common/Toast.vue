<script lang="ts" setup>
import { ref, watch } from 'vue'
import { ToastProvider, ToastRoot, ToastTitle, ToastDescription, ToastViewport } from 'reka-ui'

const props = defineProps<{
  title: string
  desc: string
}>()

const visible = ref(false)

let timer: ReturnType<typeof setTimeout>

watch(() => [props.title, props.desc], () => {
  if (props.title) {
    visible.value = true
    clearTimeout(timer)
    timer = setTimeout(() => { visible.value = false }, 2200)
  }
})
</script>

<template>
  <ToastProvider>
    <ToastRoot
      v-model:open="visible"
      :duration="2200"
      class="absolute left-4 right-4 bottom-14 min-h-50px px-3.5 py-3 rounded-18px flex items-center gap-2.5 z-20 data-[state=open]:animate-slideIn data-[state=closed]:animate-slideOut"
      style="background: rgba(17,17,17,0.9); color: white; box-shadow: 0 24px 70px rgba(0,0,0,0.16); backdrop-filter: blur(20px)"
    >
      <div
        class="w-26px h-26px rounded-full bg-#16a34a grid place-items-center text-13px flex-shrink-0"
      >
        ✓
      </div>
      <div>
        <ToastTitle class="text-12px font-bold">{{ title }}</ToastTitle>
        <ToastDescription class="mt-px text-11px text-white/68">{{ desc }}</ToastDescription>
      </div>
    </ToastRoot>
    <ToastViewport class="fixed bottom-0 left-0 right-0 p-4 z-20" />
  </ToastProvider>
</template>

<style scoped>
.animate-slideIn {
  animation: slideIn 0.24s ease;
}
.animate-slideOut {
  animation: slideOut 0.24s ease;
}
@keyframes slideIn {
  from { opacity: 0; transform: translateY(18px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes slideOut {
  from { opacity: 1; transform: translateY(0); }
  to { opacity: 0; transform: translateY(18px); }
}
</style>
