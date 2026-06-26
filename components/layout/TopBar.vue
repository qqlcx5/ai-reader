<script lang="ts" setup>
defineProps<{
  currentView: string
}>()

const emit = defineEmits<{
  navigate: [view: string]
}>()
</script>

<template>
  <header
    class="h-64px px-3.5 pt-3.5 pb-2.5 flex items-center justify-between flex-shrink-0"
  >
    <div class="flex items-center gap-2.5">
      <div
        class="w-36px h-36px rounded-13px grid place-items-center text-white font-bold tracking-tight"
        style="background: linear-gradient(145deg, #111111, #3f3f46); box-shadow: inset 0 1px 0 rgba(255,255,255,0.2), 0 12px 24px rgba(0,0,0,0.18)"
      >
        P
      </div>
      <div>
        <div class="text-14px font-bold tracking-tight">PageMind</div>
        <div class="mt-px text-11px text-#6e6e73">Readable web, saved locally</div>
      </div>
    </div>

    <div class="flex items-center gap-2">
      <div
        class="h-28px inline-flex items-center gap-1.5 px-2.5 rounded-full text-11px font-semibold"
        style="background: rgba(22,163,74,0.08); border: 1px solid rgba(22,163,74,0.15); color: #15803d"
      >
        <span
          class="w-7px h-7px rounded-full"
          style="background: #16a34a; box-shadow: 0 0 0 4px rgba(22,163,74,0.12)"
        />
        Local
      </div>
      <button
        class="w-32px h-32px rounded-12px border border-#e4e4e7 bg-white/72 color-#3f3f46 cursor-pointer transition-all duration-150 hover:bg-white hover:border-#d4d4d8 hover:-translate-y-px"
        title="设置"
        @click="emit('navigate', 'settings')"
      >
        ⌘
      </button>
    </div>
  </header>
</template>
