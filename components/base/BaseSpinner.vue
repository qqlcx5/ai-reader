<script lang="ts" setup>
import { Loader2 } from 'lucide-vue-next';

withDefaults(defineProps<{
  size?: 'sm' | 'md' | 'lg';
  label?: string;
}>(), {
  size: 'md',
  label: 'Loading',
});

const sizeClass: Record<string, string> = {
  sm: 'w-3 h-3',
  md: 'w-4 h-4',
  lg: 'w-6 h-6',
};
</script>

<template>
  <span class="inline-flex items-center gap-2" role="status" :aria-label="label">
    <Loader2 :class="[sizeClass[size], 'animate-spin text-[var(--text-accent)]']" />
    <span v-if="label && label !== 'Loading'" class="text-[var(--font-ui-small)] text-[var(--text-muted)]">{{ label }}</span>
  </span>
</template>
