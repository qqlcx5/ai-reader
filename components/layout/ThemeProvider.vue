<script lang="ts" setup>
import { onMounted, watch } from 'vue';
import { useUiStore } from '@/stores/ui.store';

const ui = useUiStore();

onMounted(() => {
  // Apply persisted theme on mount.
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.theme = ui.theme;
  }
});

watch(
  () => ui.theme,
  (t) => {
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.theme = t;
    }
  },
);
</script>

<template>
  <div class="theme-provider" :data-theme="ui.theme">
    <slot />
  </div>
</template>

<style scoped>
.theme-provider {
  min-height: 100%;
  background: var(--bg);
  color: var(--text);
}
</style>
