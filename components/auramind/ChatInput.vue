<script lang="ts" setup>
import { ref } from 'vue'
import { Cpu, ChevronDown, Paperclip, Send } from '@lucide/vue'
import RekaButton from '@/components/ui/RekaButton.vue'
import RekaTextarea from '@/components/ui/RekaTextarea.vue'

const emit = defineEmits<{
  send: [text: string]
}>()

const text = ref('')

function submit() {
  const msg = text.value.trim()
  if (!msg) return
  emit('send', msg)
  text.value = ''
}
</script>

<template>
  <div class="absolute left-0 right-0 bottom-0 p-3 bg-gradient-to-t from-[#FAFAFA] via-[#FAFAFA] to-transparent z-20">
    <div class="bg-white border border-zinc-200 rounded-2xl shadow-lg overflow-hidden">
      <div class="flex items-center justify-between px-3 pt-2">
        <RekaButton variant="ghost" size="sm">
          <Cpu class="w-3 h-3" />
          Claude 3.5 Sonnet
          <ChevronDown class="w-3 h-3" />
        </RekaButton>

        <RekaButton variant="ghost" size="sm" class="text-[11px] text-zinc-400">
          <Paperclip class="w-3 h-3" />
          当前网页
        </RekaButton>
      </div>

      <div class="relative">
        <RekaTextarea
          v-model="text"
          :rows="1"
          auto-height
          class="w-full bg-transparent text-[13px] px-3 py-2.5 pr-11 placeholder:text-zinc-400 min-h-[42px] focus:border-transparent"
          placeholder="基于当前网页继续提问..."
          @keydown.enter.exact.prevent="submit"
        />
        <RekaButton
          variant="primary"
          class="absolute right-2 bottom-2 p-1.5 !rounded-lg"
          @click="submit"
        >
          <Send class="w-3.5 h-3.5" />
        </RekaButton>
      </div>
    </div>
  </div>
</template>
