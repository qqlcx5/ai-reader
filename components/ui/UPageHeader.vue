<script lang="ts" setup>
/*
 * Page header with title, subtitle, and action slot.
 */

defineOptions({
  inheritAttrs: false,
})

const props = withDefaults(
  defineProps<{
    title?: string
    description?: string
    sticky?: boolean
  }>(),
  {
    sticky: false,
  },
)
</script>

<template>
  <div
    v-bind="$attrs"
    class="flex items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-3 shadow-sm"
    :class="sticky ? 'sticky top-0 z-20' : ''"
  >
    <div class="min-w-0 flex-1">
      <slot name="title" :title="title">
        <h2 v-if="title" class="truncate text-[15px] font-semibold text-zinc-900">
          {{ title }}
        </h2>
      </slot>
      <slot name="description" :description="description">
        <p v-if="description" class="mt-1 text-[12px] leading-5 text-zinc-500">
          {{ description }}
        </p>
      </slot>
    </div>

    <div class="shrink-0">
      <slot name="actions" />
    </div>
  </div>
</template>
