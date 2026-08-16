<script lang="ts" setup>
import { computed, ref } from 'vue'
import { GraduationCap, Plug } from '@lucide/vue'
import UButton from '@/components/ui/UButton.vue'
import UInput from '@/components/ui/UInput.vue'
import { useSettingsStore } from '@/stores/settings.store'
import { useAppStore } from '@/stores/app.store'
import { pushToAnki, DEFAULT_ANKI_CONFIG } from '@/services/anki/anki-connect'
import { FlashcardRepository } from '@/db/repositories/flashcard.repository'

const settingsStore = useSettingsStore()
const appStore = useAppStore()

const url = computed({
  get: () => settingsStore.anki.url,
  set: (val: string) => settingsStore.updateAnkiConfig({ url: val }),
})

const deck = computed({
  get: () => settingsStore.anki.deck,
  set: (val: string) => settingsStore.updateAnkiConfig({ deck: val }),
})

const testing = ref(false)

async function testConnection() {
  testing.value = true
  try {
    // 用一张卡实测（重复卡会返回 skipped，同样证明连通）。
    const cards = await FlashcardRepository.findAll()
    if (cards.length === 0) {
      const { added } = await pushToAnki(
        [{ id: 'probe', documentId: '', front: 'AuraMind 连接测试', back: '可以删除这张卡', source: 'manual', sm2: { ease: 2.5, intervalDays: 0, reps: 0, lapses: 0, dueAt: '' }, createdAt: '', updatedAt: '' }],
        { url: url.value || DEFAULT_ANKI_CONFIG.url, deck: deck.value || 'AuraMind' },
      )
      appStore.showToast(added > 0 ? '连接成功（测试卡已加入 Anki）' : '连接成功', 'success')
    } else {
      await pushToAnki([cards[0]], { url: url.value || DEFAULT_ANKI_CONFIG.url, deck: deck.value || 'AuraMind' })
      appStore.showToast('连接成功', 'success')
    }
  } catch (e: any) {
    appStore.showToast(`连接失败：${e?.message || '请确认 Anki 与 AnkiConnect 插件已启动'}`, 'error')
  } finally {
    testing.value = false
  }
}
</script>

<template>
  <div class="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden text-[13px]">
    <div class="p-3 border-b border-zinc-100 flex items-center gap-2">
      <GraduationCap class="w-4 h-4 text-zinc-400" />
      <span class="text-zinc-700">Anki 直推（AnkiConnect）</span>
    </div>
    <div class="p-3 flex flex-col gap-2.5">
      <div class="flex flex-col gap-1">
        <span class="text-[11px] text-zinc-500">AnkiConnect 地址</span>
        <UInput v-model="url" placeholder="http://127.0.0.1:8765" class="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-2.5 py-2 font-mono text-[12px] focus:border-brand" />
      </div>
      <div class="flex flex-col gap-1">
        <span class="text-[11px] text-zinc-500">目标牌组（不存在会自动创建）</span>
        <UInput v-model="deck" placeholder="AuraMind" class="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-2.5 py-2 text-[12px] focus:border-brand" />
      </div>
      <div class="flex items-center justify-between">
        <span class="text-[11px] text-zinc-400">需要桌面版 Anki + AnkiConnect 插件（默认端口 8765）</span>
        <UButton size="sm" variant="secondary" :disabled="testing" @click="testConnection">
          <Plug class="w-3.5 h-3.5" />
          {{ testing ? '测试中…' : '测试连接' }}
        </UButton>
      </div>
      <div class="text-[11px] text-zinc-400">推送入口在「复习」页的「推送 Anki」按钮。</div>
    </div>
  </div>
</template>
