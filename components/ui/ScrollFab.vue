<script lang="ts" setup>
defineProps<{ visible: boolean }>()
</script>

<template>
  <Transition name="fab-fade">
    <div v-if="visible" class="absolute bottom-4 right-4 z-20">
      <slot />
    </div>
  </Transition>
</template>

<style scoped>
.fab-fade-enter-active,
.fab-fade-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.fab-fade-enter-from,
.fab-fade-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>
