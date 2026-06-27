<script setup lang="ts">
import { useToast } from '../composables/useToast'
import { Check, AlertCircle, Info, X } from '@lucide/vue'

const { toasts, removeToast } = useToast()

const iconMap: Record<string, typeof Check> = {
  success: Check,
  error: AlertCircle,
  info: Info,
}

const colorMap: Record<string, string> = {
  success: 'bg-green-50 border-green-200 text-green-700',
  error: 'bg-red-50 border-red-200 text-red-700',
  info: 'bg-blue-50 border-blue-200 text-blue-700',
}
</script>

<template>
  <div role="status" aria-live="polite" class="fixed bottom-16 left-2 right-2 z-50 flex flex-col gap-2 pointer-events-none">
    <TransitionGroup name="toast">
      <div
        v-for="toast in toasts"
        :key="toast.id"
        :class="colorMap[toast.type] || colorMap.info"
        class="flex items-start gap-2 px-3 py-2 rounded-12px border shadow-lg pointer-events-auto text-sm"
      >
        <component :is="iconMap[toast.type] || iconMap.info" class="w-4 h-4 mt-0.5 flex-shrink-0" />
        <div class="flex-1 min-w-0">
          <p class="font-medium text-xs">{{ toast.title }}</p>
          <p v-if="toast.description" class="text-10px opacity-70 mt-0.5">{{ toast.description }}</p>
        </div>
        <button
          class="ml-1 bg-transparent border-0 cursor-pointer opacity-50 hover:opacity-100 p-0"
          @click="removeToast(toast.id)"
        >
          <X class="w-3.5 h-3.5" />
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-enter-active { transition: all 0.3s ease-out; }
.toast-leave-active { transition: all 0.2s ease-in; }
.toast-enter-from { opacity: 0; transform: translateY(16px); }
.toast-leave-to { opacity: 0; transform: translateY(-8px); }
</style>
