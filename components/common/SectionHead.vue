<script lang="ts" setup>
defineProps<{
  title: string
  action?: string
}>()

defineEmits<{
  action: []
}>()
</script>

<template>
  <div class="mb-3 flex items-center justify-between text-#a1a1aa text-11px font-bold tracking-widest uppercase">
    <span>{{ title }}</span>
    <span
      v-if="action"
      class="text-#52525b normal-case tracking-normal text-11px cursor-pointer select-none hover:text-#111"
      @click="$emit('action')"
    >{{ action }}</span>
  </div>
</template>
