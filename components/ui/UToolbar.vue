<script lang="ts" setup>
/*
 * Horizontal toolbar for page-level actions and filters.
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
    :class="sticky ? 'sticky top-0 z-10' : ''"
  >
    <div class="min-w-0 flex-1">
      <slot name="left" :title="title" :description="description">
        <div v-if="title" class="truncate text-[14px] font-semibold text-zinc-900">
          {{ title }}
        </div>
        <div v-if="description" class="mt-1 text-[12px] leading-5 text-zinc-500">
          {{ description }}
        </div>
      </slot>
    </div>

    <div class="shrink-0">
      <slot name="right" />
    </div>
  </div>
</template>
