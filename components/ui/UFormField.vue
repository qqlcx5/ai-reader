<script lang="ts" setup>
import { computed } from 'vue'

/*
 * Field wrapper for consistent label / hint / error / actions layout.
 */

defineOptions({
  inheritAttrs: false,
})

const props = withDefaults(
  defineProps<{
    label?: string
    hint?: string
    error?: string
    required?: boolean
    layout?: 'stack' | 'inline'
  }>(),
  {
    required: false,
    layout: 'stack',
  },
)

const showLabel = computed(() => Boolean(props.label))
const showMeta = computed(() => Boolean(props.hint || props.error))
</script>

<template>
  <div
    v-bind="$attrs"
    class="min-w-0"
    :class="layout === 'inline' ? 'flex items-start gap-3' : 'space-y-1.5'"
  >
    <label
      v-if="showLabel"
      class="block text-[11px] font-medium text-zinc-500"
      :class="layout === 'inline' ? 'pt-2 shrink-0 min-w-[88px]' : ''"
    >
      <span>{{ label }}</span>
      <span v-if="required" class="ml-0.5 text-red-400">*</span>
    </label>

    <div class="min-w-0 flex-1">
      <slot />

      <div v-if="showMeta || $slots.help || $slots.extra" class="mt-1 space-y-1">
        <slot name="help" :hint="hint">
          <p v-if="hint && !error" class="text-[10px] leading-4 text-zinc-400">
            {{ hint }}
          </p>
        </slot>

        <slot name="error" :error="error">
          <p v-if="error" class="text-[10px] leading-4 text-red-400">
            {{ error }}
          </p>
        </slot>

        <slot name="extra" :hint="hint" :error="error" />
      </div>
    </div>
  </div>
</template>
