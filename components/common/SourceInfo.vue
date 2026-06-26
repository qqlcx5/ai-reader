<script lang="ts" setup>
import Favicon from './Favicon.vue'

defineProps<{
  letter: string
  siteName: string
  url: string
}>()
</script>

<template>
  <div class="flex items-center gap-2.5 mb-3">
    <Favicon :letter="letter" />
    <div class="min-w-0">
      <div class="text-12px font-semibold text-#3f3f46">{{ siteName }}</div>
      <div class="mt-px max-w-295px text-11px text-#a1a1aa whitespace-nowrap overflow-hidden text-ellipsis">
        {{ url }}
      </div>
    </div>
  </div>
</template>
