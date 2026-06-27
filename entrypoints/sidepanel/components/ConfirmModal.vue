<script setup lang="ts">
import { useModal } from '../composables/useModal'

const { isOpen, title, description, confirmLabel, cancelLabel, variant, confirm, cancel } = useModal()
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="isOpen"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        class="fixed inset-0 z-60 flex items-center justify-center"
      >
        <div class="absolute inset-0 bg-black/30 backdrop-blur-sm" @click="cancel" />
        <div class="relative bg-white rounded-20px shadow-xl p-5 mx-4 w-full max-w-320px">
          <h3 id="confirm-modal-title" class="text-sm font-semibold text-text">{{ title }}</h3>
          <p v-if="description" class="text-xs text-gray-500 mt-2">{{ description }}</p>
          <div class="flex justify-end gap-3 mt-4">
            <button
              class="px-4 py-1.5 text-xs rounded-12px bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors border-0 cursor-pointer"
              @click="cancel"
            >
              {{ cancelLabel }}
            </button>
            <button
              class="px-4 py-1.5 text-xs rounded-12px text-white transition-colors border-0 cursor-pointer"
              :class="variant === 'danger' ? 'bg-red-500 hover:bg-red-600' : 'bg-blue hover:bg-blue-600'"
              @click="confirm"
            >
              {{ confirmLabel }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-enter-active { transition: all 0.2s ease-out; }
.modal-leave-active { transition: all 0.15s ease-in; }
.modal-enter-from { opacity: 0; }
.modal-enter-from > div:last-child { transform: scale(0.95); }
.modal-leave-to { opacity: 0; }
</style>
