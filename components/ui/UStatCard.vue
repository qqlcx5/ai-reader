<script lang="ts" setup>
import UCard from './UCard.vue'
import UBadge from './UBadge.vue'

/*
 * Statistics tile with value, label, hint, and optional prefix/suffix.
 */

defineOptions({
  inheritAttrs: false,
})

const props = withDefaults(
  defineProps<{
    label: string
    value: string | number
    hint?: string
    badge?: string
    badgeVariant?: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'ghost'
    trend?: 'up' | 'down' | 'flat'
  }>(),
  {
    badgeVariant: 'default',
    trend: 'flat',
  },
)

function trendClass() {
  if (props.trend === 'up') return 'text-emerald-600'
  if (props.trend === 'down') return 'text-red-500'
  return 'text-zinc-500'
}

function trendIcon() {
  if (props.trend === 'up') return '↗'
  if (props.trend === 'down') return '↘'
  return '→'
}
</script>

<template>
  <UCard v-bind="$attrs" class="h-full" :padded="true">
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2">
          <p class="text-[11px] font-medium text-zinc-500 truncate">
            {{ label }}
          </p>
          <UBadge v-if="badge" :variant="badgeVariant" size="sm">
            {{ badge }}
          </UBadge>
        </div>

        <div class="mt-2 flex items-end gap-2">
          <div class="text-[24px] font-semibold tracking-tight text-zinc-900">
            {{ value }}
          </div>
          <span v-if="trend !== 'flat'" class="pb-1 text-[11px] font-medium" :class="trendClass()">
            {{ trendIcon() }}
          </span>
        </div>

        <p v-if="hint" class="mt-2 text-[12px] leading-5 text-zinc-500">
          {{ hint }}
        </p>
      </div>

      <slot name="extra" />
    </div>
  </UCard>
</template>
