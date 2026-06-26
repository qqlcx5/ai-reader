<script lang="ts" setup>
import { ref, watch } from 'vue'

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
  <Transition name="toast">
    <div
      v-if="visible"
      class="absolute left-4 right-4 bottom-14 min-h-50px px-3.5 py-3 rounded-18px flex items-center gap-2.5 z-20"
      style="background: rgba(17,17,17,0.9); color: white; box-shadow: 0 24px 70px rgba(0,0,0,0.16); backdrop-filter: blur(20px)"
    >
      <div
        class="w-26px h-26px rounded-full bg-#16a34a grid place-items-center text-13px flex-shrink-0"
      >
        ✓
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
