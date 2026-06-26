<script lang="ts" setup>
defineProps<{
  title: string
  desc: string
  loading?: boolean
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
    role="dialog"
    aria-modal="true"
    aria-label="删除确认对话框"
    tabindex="-1"
    @click.self="$emit('cancel')"
    @keydown.esc="$emit('cancel')"
  >
    <div
      class="w-full px-4 py-4 rounded-24px"
      style="border: 1px solid rgba(29,29,31,0.08); background: rgba(255,255,255,0.92); box-shadow: 0 24px 70px rgba(0,0,0,0.16)"
      @click.stop
    >
      <div class="text-16px font-bold tracking-tight">{{ title }}</div>
      <div class="mt-2 text-12px text-#6e6e73 leading-relaxed">{{ desc }}</div>
      <div class="mt-4 grid grid-cols-2 gap-2">
        <button
          class="h-38px rounded-14px border border-rgba(29,29,31,0.08) bg-white/72 text-#3f3f46 text-13px font-semibold cursor-pointer transition-all hover:bg-white hover:-translate-y-px"
          aria-label="取消删除"
          :disabled="loading"
          @click="$emit('cancel')"
        >
          取消
        </button>
        <button
          class="h-38px rounded-14px bg-#dc2626 text-white text-13px font-bold cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="确认删除文章"
          :disabled="loading"
          @click="$emit('confirm')"
        >
          {{ loading ? '删除中...' : '确认删除' }}
        </button>
      </div>
    </div>
  </div>
</template>
