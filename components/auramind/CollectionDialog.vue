<script lang="ts" setup>
import { ref, watch } from 'vue'
import { X } from '@lucide/vue'
import UButton from '@/components/ui/UButton.vue'
import UInput from '@/components/ui/UInput.vue'

const props = defineProps<{
  open: boolean
  mode: 'create' | 'rename'
  initialName?: string
  initialDescription?: string
}>()

const emit = defineEmits<{
  close: []
  submit: [name: string, description: string]
}>()

const name = ref('')
const description = ref('')

watch(
  () => props.open,
  (v) => {
    if (v) {
      name.value = props.initialName ?? ''
      description.value = props.initialDescription ?? ''
    }
  },
)

function submit() {
  if (!name.value.trim()) return
  emit('submit', name.value, description.value)
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm flex items-center justify-center p-6"
      @click.self="emit('close')"
    >
      <div class="w-full max-w-xs bg-white rounded-2xl border border-zinc-200 shadow-2xl p-4">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-[14px] font-semibold">{{ mode === 'create' ? '新建合集' : '重命名合集' }}</h3>
          <UButton variant="ghost" @click="emit('close')">
            <X class="w-4 h-4" />
          </UButton>
        </div>

        <div class="space-y-2">
          <UInput
            v-model="name"
            placeholder="合集名称"
            class="w-full h-9 rounded-lg border border-zinc-200 px-3 text-[13px]"
          />
          <UInput
            v-model="description"
            placeholder="描述（可选）"
            class="w-full h-9 rounded-lg border border-zinc-200 px-3 text-[13px]"
          />
        </div>

        <div class="flex gap-2 mt-4">
          <UButton variant="secondary" size="lg" class="flex-1" @click="emit('close')">取消</UButton>
          <UButton variant="primary" size="lg" class="flex-1" :disabled="!name.trim()" @click="submit">
            {{ mode === 'create' ? '创建' : '保存' }}
          </UButton>
        </div>
      </div>
    </div>
  </Teleport>
</template>
