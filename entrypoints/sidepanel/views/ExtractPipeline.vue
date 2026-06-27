<script setup lang="ts">
import { computed } from 'vue'
import { useCaptureStore } from '@/stores/capture'
import { Check, Loader, AlertCircle } from '@lucide/vue'

const capture = useCaptureStore()

const steps = [
  { key: 'extracting', label: '提取内容' },
  { key: 'markdown', label: '转换格式' },
  { key: 'saving', label: '保存文章' },
]

function stepStatus(key: string) {
  if (capture.step === 'error') return 'error'
  if (capture.step === 'success') return 'done'
  if (capture.step === key) return 'active'
  const stepOrder = ['extracting', 'markdown', 'saving']
  const currentIdx = stepOrder.indexOf(capture.step)
  const thisIdx = stepOrder.indexOf(key)
  if (currentIdx > thisIdx) return 'done'
  return 'idle'
}
</script>

<template>
  <div v-if="capture.step !== 'idle'" class="px-4 py-3" role="status" aria-label="Extraction Pipeline Progress">
    <div class="flex items-center justify-between gap-1">
      <div v-for="(step, idx) in steps" :key="step.key" class="flex items-center gap-1">
        <div class="flex items-center gap-1.5">
          <span
            class="w-5 h-5 rounded-full flex items-center justify-center text-10px"
            :class="{
              'bg-blue text-white': stepStatus(step.key) === 'active',
              'bg-green-100 text-green-600': stepStatus(step.key) === 'done',
              'bg-red-100 text-red-500': stepStatus(step.key) === 'error',
              'bg-gray-100 text-gray-400': stepStatus(step.key) === 'idle',
            }"
          >
            <Check v-if="stepStatus(step.key) === 'done'" class="w-3 h-3" />
            <Loader v-else-if="stepStatus(step.key) === 'active'" class="w-3 h-3 animate-spin" />
            <AlertCircle v-else-if="stepStatus(step.key) === 'error'" class="w-3 h-3" />
            <span v-else>{{ idx + 1 }}</span>
          </span>
          <span
            class="text-10px"
            :class="{
              'text-blue font-medium': stepStatus(step.key) === 'active',
              'text-green-600': stepStatus(step.key) === 'done',
              'text-red-500': stepStatus(step.key) === 'error',
              'text-gray-400': stepStatus(step.key) === 'idle',
            }"
          >{{ step.label }}</span>
        </div>
        <div v-if="idx < steps.length - 1" class="h-px w-4" :class="stepStatus(step.key) === 'done' ? 'bg-green-200' : 'bg-gray-200'" />
      </div>
    </div>
    <p v-if="capture.step === 'error'" class="text-10px text-red-500 mt-2">错误码: {{ capture.errorCode }}</p>
  </div>
</template>
