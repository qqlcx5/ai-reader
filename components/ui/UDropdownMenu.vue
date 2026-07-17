<script lang="ts" setup>
import {
  DropdownMenuRoot,
  DropdownMenuTrigger,
  DropdownMenuPortal,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from 'reka-ui'
import type { Component } from 'vue'

export interface DropdownMenuAction {
  key: string
  label: string
  icon?: Component
  danger?: boolean
  disabled?: boolean
  separatorBefore?: boolean
}

defineProps<{
  items: DropdownMenuAction[]
  align?: 'start' | 'center' | 'end'
  sideOffset?: number
  contentClass?: string
}>()

const emit = defineEmits<{
  select: [item: DropdownMenuAction]
}>()
</script>

<template>
  <DropdownMenuRoot>
    <DropdownMenuTrigger as-child>
      <slot name="trigger">
        <button type="button" class="p-1 rounded-md text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors">
          ...
        </button>
      </slot>
    </DropdownMenuTrigger>
    <DropdownMenuPortal>
      <DropdownMenuContent
        :align="align ?? 'end'"
        :side-offset="sideOffset ?? 4"
        :class="['z-50 min-w-[140px] rounded-lg border border-zinc-200 bg-white p-1 shadow-lg outline-none', contentClass]"
      >
        <template v-for="item in items" :key="item.key">
          <DropdownMenuSeparator v-if="item.separatorBefore" class="my-1 h-px bg-zinc-100" />
          <DropdownMenuItem
            :disabled="item.disabled"
            :class="[
              'flex items-center gap-2 px-2.5 py-1.5 text-[11px] outline-none cursor-pointer data-[highlighted]:bg-zinc-100',
              item.danger ? 'text-red-500 data-[highlighted]:bg-red-50' : 'text-zinc-700',
            ]"
            @select="emit('select', item)"
          >
            <slot name="item" :item="item">
              <component :is="item.icon" v-if="item.icon" class="w-3.5 h-3.5" />
              <span>{{ item.label }}</span>
            </slot>
          </DropdownMenuItem>
        </template>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
