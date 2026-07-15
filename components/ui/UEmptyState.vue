<script lang="ts" setup>
import { computed } from 'vue'
import UButton from './UButton.vue'

/*
 * Generic empty state with data-driven actions and slot fallbacks.
 */

type EmptyAction = {
  key?: string
  label: string
  variant?: 'primary' | 'secondary' | 'ghost'
  disabled?: boolean
}

const props = withDefaults(
  defineProps<{
    title?: string
    description?: string
    actions?: EmptyAction[]
    dense?: boolean
  }>(),
  {
    actions: () => [],
    dense: false,
  },
)

const emit = defineEmits<{
  action: [action: EmptyAction, index: number]
}>()

const showBody = computed(() => Boolean(props.title || props.description || props.actions.length))

function getActionClass(variant: EmptyAction['variant']) {
  if (variant === 'primary') return 'bg-brand text-white hover:bg-brand/90'
  if (variant === 'ghost') return 'bg-transparent text-zinc-500 hover:bg-zinc-100'
  return 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
}
</script>

<template>
  <div
    class="flex flex-col items-center justify-center text-center"
    :class="dense ? 'py-6 px-4' : 'py-10 px-6'"
  >
    <slot name="icon">
      <div class="flex items-center justify-center">
        <div
          class="flex items-center justify-center rounded-full border border-dashed border-zinc-200 bg-zinc-50"
          :class="dense ? 'size-12' : 'size-16'"
        >
          <div
            class="rounded-full bg-zinc-200/80"
            :class="dense ? 'size-4' : 'size-5'"
          />
        </div>
      </div>
    </slot>

    <div v-if="showBody" class="mt-4 max-w-sm">
      <slot name="title" :title="title">
        <h3
          v-if="title"
          class="text-[14px] font-semibold text-zinc-900"
        >
          {{ title }}
        </h3>
      </slot>

      <slot name="description" :description="description">
        <p
          v-if="description"
          class="mt-2 text-[12px] leading-5 text-zinc-500"
        >
          {{ description }}
        </p>
      </slot>
    </div>

    <div v-if="actions.length || $slots.actions" class="mt-5">
      <slot name="actions" :actions="actions">
        <div class="flex flex-wrap items-center justify-center gap-2">
          <UButton
            v-for="(action, index) in actions"
            :key="action.key ?? `${action.label}-${index}`"
            :disabled="action.disabled"
            :variant="action.variant === 'primary' ? 'primary' : action.variant === 'ghost' ? 'ghost' : 'secondary'"
            size="md"
            :class="action.variant ? getActionClass(action.variant) : ''"
            @click="emit('action', action, index)"
          >
            {{ action.label }}
          </UButton>
        </div>
      </slot>
    </div>

    <div v-if="$slots.footer" class="mt-4">
      <slot name="footer" />
    </div>
  </div>
</template>
