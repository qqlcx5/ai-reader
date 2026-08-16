<script lang="ts">
export default { name: 'ReviewView' }
</script>

<script lang="ts" setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { Sparkles, Trash2, RefreshCw, CheckCircle2, FileDown, Send } from '@lucide/vue'
import { useAppStore } from '@/stores/app.store'
import { useReviewStore } from '@/stores/review.store'
import { useDocumentStore } from '@/stores/document.store'
import { useModelStore } from '@/stores/model.store'
import { previewIntervalDays, type ReviewGrade } from '@/utils/sm2'
import { DocumentRepository } from '@/db/repositories/document.repository'
import { FlashcardRepository } from '@/db/repositories/flashcard.repository'
import { exportFlashcardsToAnkiTxt } from '@/utils/anki-export'
import { downloadBlob } from '@/utils/export'
import { pushToAnki } from '@/services/anki/anki-connect'
import { useSettingsStore } from '@/stores/settings.store'
import UButton from '@/components/ui/UButton.vue'
import UEmptyState from '@/components/ui/UEmptyState.vue'
import DocumentPickerDialog from '@/components/auramind/DocumentPickerDialog.vue'

const appStore = useAppStore()
const reviewStore = useReviewStore()
const documentStore = useDocumentStore()
const modelStore = useModelStore()
const settingsStore = useSettingsStore()

const showPicker = ref(false)

const currentCard = computed(() => reviewStore.currentCard)
const hasAnyCard = computed(() => reviewStore.totalCount > 0)
const currentDocument = computed(() => documentStore.currentDocument)

const gradeButtons = computed(() => {
  const card = currentCard.value
  if (!card) return []
  return (['again', 'hard', 'good', 'easy'] as const).map((grade) => ({
    grade,
    label: { again: '忘了', hard: '困难', good: '良好', easy: '简单' }[grade],
    interval: formatInterval(previewIntervalDays(card.sm2, grade)),
    class: {
      again: 'bg-red-50 text-red-600 hover:bg-red-100 border-red-100',
      hard: 'bg-amber-50 text-amber-600 hover:bg-amber-100 border-amber-100',
      good: 'bg-brand/10 text-brand hover:bg-brand/20 border-brand/20',
      easy: 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border-emerald-100',
    }[grade],
  }))
})

function formatInterval(days: number): string {
  if (days < 30) return `${days}天`
  if (days < 365) return `${Math.round(days / 30)}个月`
  return `${(days / 365).toFixed(1)}年`
}

onMounted(() => {
  reviewStore.loadQueue()
  window.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
})

function onKeydown(e: KeyboardEvent) {
  if (appStore.currentView !== 'review') return
  if (reviewStore.generating || reviewStore.loading) return
  if (e.key === ' ' || e.key === 'Enter') {
    e.preventDefault()
    reviewStore.flip()
  } else if (reviewStore.flipped && ['1', '2', '3', '4'].includes(e.key)) {
    const grades: ReviewGrade[] = ['again', 'hard', 'good', 'easy']
    reviewStore.grade(grades[Number(e.key) - 1])
  }
}

async function generateFromCurrent() {
  const doc = currentDocument.value
  if (!doc) {
    appStore.showToast('工作区还没有文档，请先抓取或从记忆库选择', 'error')
    return
  }
  const model = modelStore.defaultModel
  if (!model) {
    appStore.showToast('请先在设置中添加并启用模型', 'error')
    return
  }
  const n = await reviewStore.generateForDocument(doc, model)
  appStore.showToast(
    n > 0 ? `已生成 ${n} 张闪卡` : (reviewStore.generateError || '没有生成新卡片（可能已全部覆盖）'),
    n > 0 ? 'success' : 'warning',
  )
}

const pushing = ref(false)

async function pushToAnkiConnect() {
  pushing.value = true
  try {
    const cards = await FlashcardRepository.findAll()
    if (cards.length === 0) {
      appStore.showToast('还没有闪卡可推送', 'warning')
      return
    }
    const { added, skipped } = await pushToAnki(cards, settingsStore.anki)
    appStore.showToast(
      added > 0 ? `已推送 ${added} 张到牌组「${settingsStore.anki.deck}」${skipped > 0 ? `，${skipped} 张重复跳过` : ''}` : '没有新卡（全部已存在）',
      added > 0 ? 'success' : 'info',
    )
  } catch (e: any) {
    appStore.showToast(`推送失败：${e?.message || '请确认 Anki 与 AnkiConnect 已启动'}`, 'error')
  } finally {
    pushing.value = false
  }
}

async function exportAnki() {
  const cards = await FlashcardRepository.findAll()
  if (cards.length === 0) {
    appStore.showToast('还没有闪卡可导出', 'warning')
    return
  }
  const date = new Date().toISOString().slice(0, 10)
  downloadBlob(exportFlashcardsToAnkiTxt(cards), `auramind-anki-${date}.txt`)
  appStore.showToast(`已导出 ${cards.length} 张闪卡，在 Anki 中选择 文件 > 导入`, 'success')
}

async function onPickerConfirm(documentIds: string[]) {
  showPicker.value = false
  const model = modelStore.defaultModel
  if (!model) {
    appStore.showToast('请先在设置中添加并启用模型', 'error')
    return
  }
  let total = 0
  for (const id of documentIds) {
    const doc = await DocumentRepository.findById(id)
    if (!doc) continue
    total += await reviewStore.generateForDocument(doc, model)
  }
  appStore.showToast(total > 0 ? `共生成 ${total} 张闪卡` : '没有生成新卡片', total > 0 ? 'success' : 'warning')
}
</script>

<template>
  <div class="flex-1 min-h-0 overflow-y-auto">
    <div class="max-w-xl mx-auto px-4 py-5 flex flex-col gap-4">
      <!-- Stats -->
      <div class="flex items-center justify-between text-xs text-zinc-500">
        <div class="flex items-center gap-3">
          <span>待复习 <b class="text-zinc-800">{{ reviewStore.remainingCount }}</b></span>
          <span>总卡片 <b class="text-zinc-800">{{ reviewStore.totalCount }}</b></span>
          <span>已复习 <b class="text-zinc-800">{{ reviewStore.reviewedToday }}</b></span>
        </div>
        <div class="flex items-center gap-1">
          <UButton size="sm" variant="ghost" :disabled="reviewStore.loading" title="刷新队列" @click="reviewStore.loadQueue()">
            <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': reviewStore.loading }" />
          </UButton>
          <UButton size="sm" variant="secondary" :disabled="reviewStore.generating" @click="generateFromCurrent">
            <Sparkles class="w-3.5 h-3.5" />
            从当前文档生成
          </UButton>
          <UButton size="sm" variant="secondary" :disabled="reviewStore.generating" @click="showPicker = true">
            <Sparkles class="w-3.5 h-3.5" />
            从记忆库生成
          </UButton>
          <UButton size="sm" variant="ghost" :disabled="reviewStore.totalCount === 0" title="导出为 Anki 可导入的 TSV" @click="exportAnki">
            <FileDown class="w-3.5 h-3.5" />
            Anki
          </UButton>
          <UButton size="sm" variant="ghost" :disabled="pushing || reviewStore.totalCount === 0" title="通过 AnkiConnect 直推到本地 Anki" @click="pushToAnkiConnect">
            <Send class="w-3.5 h-3.5" />
            {{ pushing ? '推送中…' : '推送' }}
          </UButton>
        </div>
      </div>

      <!-- Generating hint -->
      <div v-if="reviewStore.generating" class="text-center text-xs text-brand animate-pulse">
        AI 正在生成闪卡…
      </div>
      <div v-if="reviewStore.generateError" class="text-center text-xs text-red-500">
        {{ reviewStore.generateError }}
      </div>

      <!-- Review card -->
      <div
        v-if="currentCard"
        class="bg-white border border-zinc-200 rounded-2xl p-6 min-h-48 flex flex-col items-center justify-center text-center cursor-pointer select-none soft-shadow"
        @click="reviewStore.flip()"
      >
        <div class="text-[10px] uppercase tracking-wider text-zinc-400 mb-3">
          {{ reviewStore.flipped ? '答案' : '问题' }} · 点击翻面（空格）
        </div>
        <div class="text-base leading-relaxed text-zinc-800 max-w-md whitespace-pre-wrap">
          {{ reviewStore.flipped ? currentCard.back : currentCard.front }}
        </div>
        <button
          class="mt-4 p-1.5 rounded-md text-zinc-300 hover:text-red-500 hover:bg-red-50 transition-colors"
          title="删除这张卡"
          @click.stop="reviewStore.removeCurrent()"
        >
          <Trash2 class="w-3.5 h-3.5" />
        </button>
      </div>

      <!-- Grade buttons -->
      <div v-if="currentCard && reviewStore.flipped" class="grid grid-cols-4 gap-2">
        <button
          v-for="btn in gradeButtons"
          :key="btn.grade"
          class="flex flex-col items-center py-2 rounded-xl border text-xs font-medium transition-colors"
          :class="btn.class"
          @click="reviewStore.grade(btn.grade)"
        >
          <span>{{ btn.label }}</span>
          <span class="text-[10px] opacity-60">{{ btn.interval }}后</span>
        </button>
      </div>

      <!-- Empty states -->
      <UEmptyState
        v-if="!currentCard && !reviewStore.loading && !reviewStore.generating"
        :title="hasAnyCard ? '今日复习完成' : '还没有闪卡'"
        :description="hasAnyCard
          ? `已复习 ${reviewStore.reviewedToday} 张，明天再来吧`
          : '用 AI 从文档高亮或正文中生成问答闪卡，按 SM-2 曲线安排复习'"
        :actions="hasAnyCard ? [] : [
          { label: '从当前文档生成', variant: 'primary', disabled: !currentDocument },
          { label: '从记忆库选择文档' },
        ]"
        @action="(action) => action.label === '从当前文档生成' ? generateFromCurrent() : (showPicker = true)"
      >
        <CheckCircle2 v-if="hasAnyCard" class="w-10 h-10 text-emerald-300 mb-2" />
      </UEmptyState>

      <DocumentPickerDialog :open="showPicker" @close="showPicker = false" @confirm="onPickerConfirm" />
    </div>
  </div>
</template>
