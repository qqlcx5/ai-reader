<script lang="ts" setup>
/**
 * ThreeColumnLayout — Desktop three-column grid layout for the Options / management page.
 *
 * grid-template-columns: 250px 1fr 360px
 * Responsive: hides right col at <1250px, hides left col at <820px
 */

withDefaults(
  defineProps<{
    hideLeft?: boolean;
    hideRight?: boolean;
  }>(),
  { hideLeft: false, hideRight: false },
);
</script>

<template>
  <div
    class="three-col"
    :class="{
      'three-col--no-left': hideLeft,
      'three-col--no-right': hideRight,
    }"
  >
    <!-- Left column: 250px fixed — brand + navigation -->
    <aside class="three-col__left surface">
      <slot name="left" />
    </aside>

    <!-- Center column: 1fr — main workspace -->
    <main class="three-col__center surface">
      <slot name="center" />
    </main>

    <!-- Right column: 360px fixed — tabs panel -->
    <aside class="three-col__right surface">
      <slot name="right" />
    </aside>
  </div>
</template>

<style scoped>
.three-col {
  display: grid;
  grid-template-columns: 250px 1fr 360px;
  grid-template-rows: 1fr;
  gap: 12px;
  padding: 12px;
  height: 100vh;
  background: var(--bg);
  box-sizing: border-box;
  overflow: hidden;
}

.three-col__left,
.three-col__center,
.three-col__right {
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

/* Responsive: hide right col below 1250px */
@media (max-width: 1249px) {
  .three-col {
    grid-template-columns: 250px 1fr;
  }
  .three-col__right {
    display: none;
  }
}

/* Responsive: hide left col below 820px */
@media (max-width: 819px) {
  .three-col {
    grid-template-columns: 1fr;
  }
  .three-col__left {
    display: none;
  }
}

/* Mobile: single column */
@media (max-width: 599px) {
  .three-col {
    padding: 8px;
    gap: 8px;
  }
}

/* Explicit hide overrides */
.three-col--no-left .three-col__left {
  display: none;
}
.three-col--no-left {
  grid-template-columns: 1fr 360px;
}
@media (max-width: 1249px) {
  .three-col--no-left {
    grid-template-columns: 1fr;
  }
}

.three-col--no-right .three-col__right {
  display: none;
}
.three-col--no-right {
  grid-template-columns: 250px 1fr;
}
@media (max-width: 819px) {
  .three-col--no-right {
    grid-template-columns: 1fr;
  }
}
</style>
