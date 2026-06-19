<script lang="ts" setup>
withDefaults(defineProps<{
  title?: string;
  subtitle?: string;
  description?: string;
  noBody?: boolean;
  as?: 'div' | 'section' | 'article';
  padding?: 'none' | 'sm' | 'md';
}>(), {
  noBody: false,
  as: 'div',
  padding: 'md',
});
</script>

<template>
  <component
    :is="as"
    class="surface-card"
  >
    <header
      v-if="title || $slots.header"
      class="flex items-center justify-between px-4 py-3 border-b border-[var(--background-modifier-border)]"
    >
      <div class="flex-1 min-w-0">
        <h3 v-if="title" class="text-[var(--font-ui-medium)] font-semibold text-[var(--text-normal)] truncate">
          {{ title }}
        </h3>
        <p v-if="subtitle" class="text-[var(--font-ui-smallest)] text-[var(--text-muted)] mt-0.5">
          {{ subtitle }}
        </p>
        <p v-else-if="description" class="text-[var(--font-ui-smallest)] text-[var(--text-muted)] mt-0.5">
          {{ description }}
        </p>
      </div>
      <slot name="header" />
    </header>
    <div
      v-if="!noBody"
      :class="[
        $slots.body ? '' : (padding === 'sm' ? 'p-3' : padding === 'none' ? '' : 'p-4'),
      ]"
    >
      <slot />
    </div>
    <template v-else>
      <slot />
    </template>
    <footer
      v-if="$slots.footer"
      class="px-4 py-2.5 border-t border-[var(--background-modifier-border)] bg-[var(--background-primary-alt)]"
    >
      <slot name="footer" />
    </footer>
  </component>
</template>
