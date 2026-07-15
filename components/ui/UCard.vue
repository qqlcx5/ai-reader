<script lang="ts" setup>
import { computed } from 'vue'

/*
 * Generic card shell with slot fallbacks.
 */

defineOptions({
  inheritAttrs: false,
})

const props = withDefaults(
  defineProps<{
    title?: string
    description?: string
    hoverable?: boolean
    padded?: boolean
  }>(),
  {
    hoverable: false,
    padded: true,
  },
)

const hasHeader = computed(() => Boolean(props.title || props.description || !props.padded))
</script>

<template>
  <section
    v-bind="$attrs"
    class="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm"
    :class="hoverable ? 'transition-shadow hover:shadow-md' : ''"
  >
    <header v-if="hasHeader && (title || description || $slots.header)" class="border-b border-zinc-100 px-4 py-3">
      <slot name="header" :title="title" :description="description">
        <slot name="title" :title="title">
          <div v-if="title" class="truncate text-[14px] font-semibold text-zinc-900">
            {{ title }}
          </div>
        </slot>

        <slot name="description" :description="description">
          <div v-if="description" class="mt-1 text-[12px] leading-5 text-zinc-500">
            {{ description }}
          </div>
        </slot>
      </slot>
    </header>

    <div :class="padded ? 'p-4' : ''">
      <slot />
    </div>

    <footer v-if="$slots.footer" class="border-t border-zinc-100 px-4 py-3">
      <slot name="footer" />
    </footer>
  </section>
</template>
