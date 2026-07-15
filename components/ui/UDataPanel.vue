<script lang="ts" setup>
import { computed } from 'vue'

/*
 * A data-driven UI container with slot fallbacks.
 *
 * Goals:
 * - data-first defaults: title / description / items / actions / states
 * - slot overrides: every visual region can be replaced independently
 * - low coupling: no business-specific assumptions
 */

defineOptions({
  inheritAttrs: false,
})

type PanelAction = {
  key?: string
  label: string
  variant?: 'primary' | 'secondary' | 'ghost'
  disabled?: boolean
}

type PanelItem = {
  id?: string | number
  key?: string | number
  code?: string | number
  name?: string
  title?: string
  description?: string
  [key: string]: unknown
}

const props = withDefaults(
  defineProps<{
    title?: string
    description?: string
    items?: PanelItem[]
    loading?: boolean
    emptyText?: string
    actions?: PanelAction[]
    itemLabelKey?: string
  }>(),
  {
    items: () => [],
    loading: false,
    emptyText: '暂无数据',
    actions: () => [],
    itemLabelKey: 'name',
  },
)

const emit = defineEmits<{
  action: [action: PanelAction, index: number]
  'item-click': [item: PanelItem, index: number]
}>()

const hasItems = computed(() => props.items.length > 0)
const showHeader = computed(() => Boolean(props.title || props.description || props.actions.length))

function getItemKey(item: PanelItem, index: number) {
  return String(item.id ?? item.key ?? item.code ?? index)
}

function getItemLabel(item: PanelItem) {
  return String(item[props.itemLabelKey] ?? item.title ?? item.name ?? 'Untitled')
}

function getActionClass(variant: PanelAction['variant']) {
  if (variant === 'primary') return 'bg-brand text-white hover:bg-brand/90'
  if (variant === 'ghost') return 'bg-transparent text-zinc-500 hover:bg-zinc-100'
  return 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
}
</script>

<template>
  <section
    v-bind="$attrs"
    class="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm"
  >
    <header
      v-if="showHeader || $slots.header || $slots.title || $slots.description || $slots.actions"
      class="flex items-start justify-between gap-3 border-b border-zinc-100 px-4 py-3"
    >
      <div class="min-w-0 flex-1">
        <slot name="header" :title="title" :description="description">
          <slot name="title" :title="title">
            <div
              v-if="title"
              class="truncate text-[14px] font-semibold text-zinc-900"
            >
              {{ title }}
            </div>
          </slot>

          <slot name="description" :description="description">
            <div
              v-if="description"
              class="mt-1 text-[12px] leading-5 text-zinc-500"
            >
              {{ description }}
            </div>
          </slot>
        </slot>
      </div>

      <div class="shrink-0">
        <slot name="actions" :actions="actions">
          <div v-if="actions.length" class="flex flex-wrap gap-2">
            <button
              v-for="(action, index) in actions"
              :key="action.key ?? `${action.label}-${index}`"
              :disabled="action.disabled"
              class="inline-flex items-center justify-center rounded-lg px-3 py-1.5 text-[12px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
              :class="getActionClass(action.variant)"
              @click="emit('action', action, index)"
            >
              {{ action.label }}
            </button>
          </div>
        </slot>
      </div>
    </header>

    <div class="p-4">
      <slot :items="items" :loading="loading" :empty="!hasItems">
        <slot v-if="loading" name="loading">
          <div class="space-y-2">
            <div class="h-4 w-2/5 animate-pulse rounded bg-zinc-100" />
            <div class="h-4 w-3/5 animate-pulse rounded bg-zinc-100" />
            <div class="h-4 w-1/2 animate-pulse rounded bg-zinc-100" />
          </div>
        </slot>

        <div v-else-if="hasItems" class="space-y-2">
          <article
            v-for="(item, index) in items"
            :key="getItemKey(item, index)"
            class="cursor-pointer rounded-xl border border-zinc-200 bg-zinc-50/60 px-3 py-3 transition-colors hover:bg-zinc-50"
            @click="emit('item-click', item, index)"
          >
            <slot
              name="item"
              :item="item"
              :index="index"
              :label="getItemLabel(item)"
            >
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0 flex-1">
                  <div class="truncate text-[13px] font-medium text-zinc-900">
                    {{ getItemLabel(item) }}
                  </div>

                  <div
                    v-if="item.description"
                    class="mt-1 text-[12px] leading-5 text-zinc-500"
                  >
                    {{ item.description }}
                  </div>
                </div>

                <div v-if="$slots['item-extra']" class="shrink-0">
                  <slot name="item-extra" :item="item" :index="index" />
                </div>
              </div>
            </slot>
          </article>
        </div>

        <div v-else class="py-10 text-center">
          <slot name="empty">
            <p class="text-[12px] text-zinc-400">
              {{ emptyText }}
            </p>
          </slot>
        </div>
      </slot>
    </div>

    <footer
      v-if="$slots.footer"
      class="border-t border-zinc-100 px-4 py-3"
    >
      <slot name="footer" />
    </footer>
  </section>
</template>
