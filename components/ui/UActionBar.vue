<script lang="ts" setup>
/*
 * Compact action row for lists, dialogs, and empty states.
 */

defineOptions({
  inheritAttrs: false,
})

type ActionItem = {
  key?: string
  label: string
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  disabled?: boolean
}

const props = withDefaults(
  defineProps<{
    items?: ActionItem[]
    align?: 'start' | 'center' | 'end' | 'between'
    wrap?: boolean
  }>(),
  {
    items: () => [],
    align: 'end',
    wrap: true,
  },
)

const emit = defineEmits<{
  action: [action: ActionItem, index: number]
}>()

function alignClass() {
  if (props.align === 'start') return 'justify-start'
  if (props.align === 'center') return 'justify-center'
  if (props.align === 'between') return 'justify-between'
  return 'justify-end'
}

function getButtonClass(variant: ActionItem['variant']) {
  if (variant === 'primary') return 'bg-brand text-white hover:bg-brand/90'
  if (variant === 'danger') return 'bg-white border border-red-100 text-red-500 hover:bg-red-50'
  if (variant === 'ghost') return 'bg-transparent text-zinc-500 hover:bg-zinc-100'
  return 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
}
</script>

<template>
  <div
    v-bind="$attrs"
    class="flex items-center gap-2"
    :class="[alignClass(), wrap ? 'flex-wrap' : 'flex-nowrap']"
  >
    <slot :items="items">
      <button
        v-for="(item, index) in items"
        :key="item.key ?? `${item.label}-${index}`"
        :disabled="item.disabled"
        class="inline-flex items-center justify-center rounded-lg px-3 py-1.5 text-[12px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
        :class="getButtonClass(item.variant)"
        @click="emit('action', item, index)"
      >
        {{ item.label }}
      </button>
    </slot>
  </div>
</template>
