<script lang="ts" setup>
defineProps<{
  letter: string
}>()
</script>

<template>
  <div
    class="w-30px h-30px rounded-10px grid place-items-center flex-shrink-0 text-#111127 text-12px font-bold"
    style="background: linear-gradient(180deg, #fafafa, #e5e7eb); border: 1px solid rgba(0,0,0,0.06)"
  >
    {{ letter }}
  </div>
</template>
