<script lang="ts" setup>
import { onMounted, onUnmounted } from 'vue';
import { X } from 'lucide-vue-next';

const props = withDefaults(defineProps<{
  open: boolean;
  title?: string;
  width?: string;
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
  ariaLabel?: string;
}>(), {
  closeOnBackdrop: true,
  closeOnEscape: true,
});

const emit = defineEmits<{
  close: [];
}>();

function handleEscape(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.open && props.closeOnEscape) {
    emit('close');
  }
}

onMounted(() => document.addEventListener('keydown', handleEscape));
onUnmounted(() => document.removeEventListener('keydown', handleEscape));
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-150"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-100"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="open"
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        :aria-label="ariaLabel || title"
      >
        <div
          class="absolute inset-0 bg-[var(--background-modifier-cover)]"
          @click="closeOnBackdrop && emit('close')"
        />
        <div
          :style="{ width: width || 'var(--modal-width)', maxWidth: 'var(--modal-max-width)' }"
          class="relative bg-[var(--modal-background)] border border-[var(--modal-border-color)] rounded-[var(--modal-radius)] [corner-shape:var(--corner-shape)] shadow-[var(--shadow-l)] max-h-[85vh] flex flex-col overflow-hidden"
        >
          <header
            v-if="title || $slots.header"
            class="flex items-center justify-between px-4 py-3 border-b border-[var(--background-modifier-border)]"
          >
            <h2 class="text-[var(--font-ui-large)] font-semibold text-[var(--text-normal)] flex-1 min-w-0 truncate">
              <slot name="header">{{ title }}</slot>
            </h2>
            <button
              type="button"
              class="clickable-icon"
              aria-label="Close dialog"
              @click="emit('close')"
            >
              <X class="w-4 h-4" />
            </button>
          </header>
          <div class="flex-1 overflow-auto p-4">
            <slot />
          </div>
          <footer
            v-if="$slots.footer"
            class="flex justify-end gap-2 px-4 py-3 border-t border-[var(--background-modifier-border)]"
          >
            <slot name="footer" />
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
