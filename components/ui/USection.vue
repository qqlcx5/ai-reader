<script lang="ts" setup>
/*
 * Section wrapper for page blocks with optional header and actions.
 */

defineOptions({
  inheritAttrs: false,
})

const props = withDefaults(
  defineProps<{
    title?: string
    description?: string
    dense?: boolean
    padded?: boolean
  }>(),
  {
    dense: false,
    padded: true,
  },
)
</script>

<template>
  <section v-bind="$attrs" class="rounded-2xl border border-zinc-200 bg-white shadow-sm">
    <header v-if="title || description || $slots.header" class="border-b border-zinc-100 px-4 py-3">
      <slot name="header" :title="title" :description="description">
        <div v-if="title" class="truncate text-[14px] font-semibold text-zinc-900">
          {{ title }}
        </div>
        <div v-if="description" class="mt-1 text-[12px] leading-5 text-zinc-500">
          {{ description }}
        </div>
      </slot>
    </header>

    <div :class="[padded ? (dense ? 'p-3' : 'p-4') : '']">
      <slot />
    </div>

    <footer v-if="$slots.footer" class="border-t border-zinc-100 px-4 py-3">
      <slot name="footer" />
    </footer>
  </section>
</template>
