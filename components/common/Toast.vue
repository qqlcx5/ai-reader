<script lang="ts" setup>
import { ref, watch } from 'vue'

const props = defineProps<{
  type: 'success' | 'error' | 'info'
  title: string
  desc: string
  duration?: number
}>()

const visible = ref(false)

let timer: ReturnType<typeof setTimeout>

watch(() => [props.title, props.desc], () => {
  if (props.title) {
    visible.value = true
    clearTimeout(timer)
    timer = setTimeout(() => { visible.value = false }, props.duration ?? 2200)
  }
})

const iconClass = {
  success: 'bg-#16a34a',
  error: 'bg-#dc2626',
  info: 'bg-#2563eb',
}
</script>

<template>
  <Transition name="toast">
    <div
      v-if="visible"
      class="absolute left-4 right-4 bottom-80px min-h-50px px-3.5 py-3 rounded-18px flex items-center gap-2.5 z-20"
      style="background: rgba(17,17,17,0.9); color: white; box-shadow: 0 24px 70px rgba(0,0,0,0.16); backdrop-filter: blur(20px)"
    >
      <div
        class="w-26px h-26px rounded-full grid place-items-center text-13px flex-shrink-0"
        :class="iconClass[type]"
      >
        {{ type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ' }}
      </div>
      <div>
        <div class="text-12px font-bold">{{ title }}</div>
        <div class="mt-px text-11px text-white/68">{{ desc }}</div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: all 0.24s ease;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(18px);
}
</style>
