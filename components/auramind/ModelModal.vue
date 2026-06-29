<script lang="ts" setup>
import { ref } from 'vue'
import { X } from '@lucide/vue'
import UButton from '@/components/ui/UButton.vue'
import UInput from '@/components/ui/UInput.vue'
import Select from '@/components/ui/Select.vue'

defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

const modelName = ref('')
const provider = ref('OpenAI Compatible')
const baseUrl = ref('')
const apiKey = ref('')
const contextSize = ref('128000')
const temperature = ref('0.9')

const providers = [
  { value: 'OpenAI Compatible', label: 'OpenAI Compatible' },
  { value: 'Anthropic Claude', label: 'Anthropic Claude' },
  { value: 'Ollama Local', label: 'Ollama Local' },
  { value: 'Gemini', label: 'Gemini' },
]
</script>

<template>
  <div
    v-if="visible"
    class="absolute inset-0 z-50 bg-black/20 backdrop-blur-sm flex items-end"
    @click.self="emit('close')"
  >
    <div class="w-full bg-white rounded-t-2xl border-t border-zinc-200 shadow-2xl p-4 animate-[slideUp_.2s_ease-out]">
      <div class="flex items-center justify-between mb-4">
        <div>
          <h3 class="text-[15px] font-semibold">添加模型节点</h3>
          <p class="text-[11px] text-zinc-400 mt-0.5">支持 OpenAI Compatible / Claude / Ollama</p>
        </div>
        <UButton variant="ghost" @click="emit('close')">
          <X class="w-4 h-4" />
        </UButton>
      </div>

      <div class="space-y-3 text-[13px]">
        <div>
          <label class="text-[11px] text-zinc-500 font-medium">模型名称</label>
          <UInput v-model="modelName" class="mt-1 w-full h-9 rounded-lg border border-zinc-200 px-3" placeholder="例如 DeepSeek Chat" />
        </div>

        <div>
          <label class="text-[11px] text-zinc-500 font-medium">服务商类型</label>
          <Select v-model="provider" :options="providers" class="mt-1" />
        </div>

        <div>
          <label class="text-[11px] text-zinc-500 font-medium">Base URL</label>
          <UInput v-model="baseUrl" class="mt-1 w-full h-9 rounded-lg border border-zinc-200 px-3 font-mono text-[12px]" placeholder="https://api.example.com/v1" />
        </div>

        <div>
          <label class="text-[11px] text-zinc-500 font-medium">API Key</label>
          <UInput v-model="apiKey" type="password" class="mt-1 w-full h-9 rounded-lg border border-zinc-200 px-3 font-mono text-[12px]" placeholder="sk-..." />
        </div>

        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="text-[11px] text-zinc-500 font-medium">上下文</label>
            <UInput v-model="contextSize" class="mt-1 w-full h-9 rounded-lg border border-zinc-200 px-3 font-mono text-[12px]" />
          </div>
          <div>
            <label class="text-[11px] text-zinc-500 font-medium">温度</label>
            <UInput v-model="temperature" class="mt-1 w-full h-9 rounded-lg border border-zinc-200 px-3 font-mono text-[12px]" />
          </div>
        </div>
      </div>

      <div class="flex gap-2 mt-5">
        <UButton variant="secondary" size="lg" class="flex-1" @click="emit('close')">
          取消
        </UButton>
        <UButton variant="primary" size="lg" class="flex-1" @click="emit('close')">
          添加模型
        </UButton>
      </div>
    </div>
  </div>
</template>

<style>
@keyframes slideUp {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}
</style>
