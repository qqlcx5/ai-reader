<script lang="ts" setup>
import type { Component } from 'vue'

defineProps<{
  icon: Component
  title: string
  subtitle?: string
}>()
</script>

<template>
  <div class="flex items-center gap-2 min-w-0">
    <div class="w-8 h-8 rounded-lg bg-zinc-100 border border-zinc-200 flex items-center justify-center shrink-0">
      <component :is="icon" class="w-4 h-4 text-brand" />
    </div>
    <div class="min-w-0">
      <div class="text-[14px] font-semibold text-zinc-900 truncate max-w-[145px]">
        {{ title }}
      </div>
      <div v-if="subtitle" class="text-[10px] text-zinc-400 truncate">
        {{ subtitle }}
      </div>
    </div>
  </div>
</template>
