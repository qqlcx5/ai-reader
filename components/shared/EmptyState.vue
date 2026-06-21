<script lang="ts" setup>
interface Props {
  title?: string;
  description?: string;
  icon?: string;
  size?: 'sm' | 'md' | 'lg';
}

withDefaults(defineProps<Props>(), {
  title: 'No content yet',
  description: '',
  icon: '◇',
  size: 'md',
});
</script>

<template>
  <div class="empty-state" :class="`empty-state--${size}`">
    <div class="empty-state__icon" aria-hidden="true">{{ icon }}</div>
    <div class="empty-state__title">{{ title }}</div>
    <div v-if="description" class="empty-state__desc">{{ description }}</div>
    <div class="empty-state__action">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-6) var(--space-5);
  text-align: center;
  color: var(--muted);
  gap: var(--space-2);
}

.empty-state__icon {
  font-size: 24px;
  color: var(--muted-light);
}

.empty-state--md .empty-state__icon {
  font-size: 32px;
}

.empty-state--lg .empty-state__icon {
  font-size: 44px;
}

.empty-state__title {
  font-size: var(--fs-xs);
  font-weight: 700;
  color: var(--text);
}

.empty-state__desc {
  font-size: var(--fs-11);
  line-height: 1.5;
  max-width: 280px;
}

.empty-state__action {
  margin-top: var(--space-3);
}
</style>
