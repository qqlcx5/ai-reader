<script setup lang="ts">
defineProps<{
  title?: string
  description?: string
}>()
</script>

<template>
  <article tabindex="0" class="rounded-20px p-4 bg-card backdrop-blur-xl border border-gray-200/60 hover:border-gray-300 hover:-translate-y-1px transition-all duration-200 cursor-pointer">
    <slot />
    <footer v-if="title || description" class="mt-3 text-12px text-gray-400 flex items-center justify-between">
      <span v-if="title" class="font-medium text-text truncate">{{ title }}</span>
      <span v-if="description">{{ description }}</span>
    </footer>
  </article>
</template>
