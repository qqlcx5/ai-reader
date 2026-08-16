<script lang="ts" setup>
import { computed } from 'vue'
import UInput from '@/components/ui/UInput.vue'
import { useSettingsStore } from '@/stores/settings.store'

const settingsStore = useSettingsStore()

const newCardsPerDay = computed({
  get: () => String(settingsStore.settings.review.newCardsPerDay),
  set: (val: string) => {
    const n = Math.max(0, Math.floor(Number(val) || 0))
    settingsStore.updateReviewSettings({ newCardsPerDay: n })
  },
})
</script>

<template>
  <div class="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden text-[13px]">
    <div class="p-3 border-b border-zinc-100 flex items-center justify-between">
      <div class="flex flex-col gap-0.5">
        <span class="text-zinc-700">每日新卡上限</span>
        <span class="text-[11px] text-zinc-400">每天最多混入多少张未复习过的新卡；0 表示不限制。到期的复习卡不受影响。</span>
      </div>
      <div class="w-20 shrink-0">
        <UInput v-model="newCardsPerDay" type="number" placeholder="0" class="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-2.5 py-2 text-[12px] text-center focus:border-brand" />
      </div>
    </div>
  </div>
</template>
