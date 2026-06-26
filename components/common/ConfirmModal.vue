<script lang="ts" setup>
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
  <div
    class="absolute inset-0 grid place-items-center p-4.5 z-30"
    style="background: rgba(244,244,245,0.58); backdrop-filter: blur(16px)"
  >
    <div
      class="w-full px-4 py-4 rounded-24px"
      style="border: 1px solid rgba(29,29,31,0.08); background: rgba(255,255,255,0.92); box-shadow: 0 24px 70px rgba(0,0,0,0.16)"
    >
      <div class="text-16px font-bold tracking-tight">{{ title }}</div>
      <div class="mt-2 text-12px text-#6e6e73 leading-relaxed">{{ desc }}</div>
      <div class="mt-4 grid grid-cols-2 gap-2">
        <button
          class="h-38px rounded-14px border border-rgba(29,29,31,0.08) bg-white/72 text-#3f3f46 text-13px font-semibold cursor-pointer transition-all hover:bg-white hover:-translate-y-px"
          @click="$emit('cancel')"
        >
          取消
        </button>
        <button
          class="h-38px rounded-14px bg-#dc2626 text-white text-13px font-bold cursor-pointer"
          @click="$emit('confirm')"
        >
          确认删除
        </button>
      </div>
    </div>
  </div>
</template>
