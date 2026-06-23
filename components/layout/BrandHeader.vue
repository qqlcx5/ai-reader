<script lang="ts" setup>
withDefaults(
  defineProps<{
    version?: string;
  }>(),
  { version: '0.1.0' },
);
</script>

<template>
  <div class="brand-header">
    <!-- Gradient icon: 40px rounded-rect with AR text -->
    <div class="brand-header__icon" aria-hidden="true">
      AR
    </div>

    <!-- Title + version -->
    <div class="brand-header__text">
      <span class="brand-header__title">AI Reader</span>
      <span class="brand-header__version">v{{ version }}</span>
    </div>
  </div>
</template>

<style scoped>
.brand-header {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 64px;
  padding: 0 14px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.brand-header__icon {
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  border-radius: 12px;
  background: linear-gradient(135deg, var(--primary) 0%, #8fa6ff 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 13px;
  font-weight: 900;
  letter-spacing: -0.02em;
  box-shadow: 0 2px 8px rgba(91, 96, 229, 0.35);
  user-select: none;
}

.brand-header__text {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.brand-header__title {
  font-size: var(--fs-sm);
  font-weight: 900;
  color: var(--text);
  line-height: 1;
  letter-spacing: -0.01em;
}

.brand-header__version {
  font-size: 10px;
  font-weight: 500;
  color: var(--muted);
  line-height: 1;
}
</style>
