<script lang="ts" setup>
import { ref, computed, watch } from 'vue'
import { Languages, RefreshCw } from '@lucide/vue'
import UButton from '@/components/ui/UButton.vue'
import Select from '@/components/ui/Select.vue'
import { useDocumentStore } from '@/stores/document.store'
import { useModelStore } from '@/stores/model.store'
import { useAppStore } from '@/stores/app.store'
import { translateDocument, splitBlocks, defaultTargetLang } from '@/services/translate/translate'
import { DocumentRepository } from '@/db/repositories/document.repository'
import { renderMarkdown } from '@/utils/markdown'

const documentStore = useDocumentStore()
const modelStore = useModelStore()
const appStore = useAppStore()

const LANGS = ['中文', 'English', '日本語', '한국어', 'Français', 'Deutsch', 'Español']

const currentDoc = computed(() => documentStore.currentDocument)
const translation = computed(() => currentDoc.value?.translation ?? null)
const targetLang = ref('')

// Reset the target language when the document changes.
watch(
  () => currentDoc.value?.id,
  (id) => {
    if (!id) return
    targetLang.value = translation.value?.lang || defaultTargetLang(currentDoc.value?.markdown || '')
  },
  { immediate: true },
)

const translating = ref(false)
const progress = ref('')

/** Alternating original/translated blocks for 对照阅读. */
const pairs = computed(() => {
  const t = translation.value
  if (!t || !currentDoc.value) return []
  const originals = splitBlocks(currentDoc.value.markdown || '')
  const translated = splitBlocks(t.markdown)
  if (originals.length !== translated.length) {
    // Alignment lost (doc edited after translation) — show translation only.
    return translated.map((block) => ({ original: '', translated: block }))
  }
  return originals.map((block, i) => ({ original: block, translated: translated[i] }))
})

async function handleTranslate() {
  const doc = currentDoc.value
  if (!doc || translating.value) return
  const model = modelStore.defaultModel
  if (!model) {
    appStore.showToast('请先在设置中添加并启用模型', 'error')
    return
  }
  translating.value = true
  progress.value = ''
  try {
    const result = await translateDocument({
      document: doc,
      model,
      targetLang: targetLang.value,
      onProgress: (done, total) => (progress.value = `${done}/${total} 段`),
    })
    const saved = await DocumentRepository.save({ ...doc, translation: result })
    documentStore.setCurrentDocument(saved)
    appStore.showToast(`翻译完成（${result.lang}）`, 'success')
  } catch (e: any) {
    appStore.showToast(e?.message || '翻译失败', 'error')
  } finally {
    translating.value = false
    progress.value = ''
  }
}

function render(md: string): string {
  return renderMarkdown(md)
}
</script>

<template>
  <div class="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col gap-3">
    <!-- Controls -->
    <div class="flex items-center gap-2">
      <Languages class="w-4 h-4 text-zinc-400 shrink-0" />
      <Select v-model="targetLang" :options="LANGS.map((l) => ({ value: l, label: l }))" class="text-[12px] w-32" />
      <UButton size="sm" variant="primary" :disabled="translating || !currentDoc" @click="handleTranslate">
        <RefreshCw v-if="translating" class="w-3.5 h-3.5 animate-spin" />
        {{ translating ? `翻译中 ${progress}` : (translation ? '重新翻译' : '翻译全文') }}
      </UButton>
      <span v-if="translation" class="text-[10px] text-zinc-400 ml-auto">
        {{ translation.lang }} · {{ translation.translatedAt.slice(0, 10) }}
      </span>
    </div>

    <!-- Aligned paragraphs: original, then grey translation -->
    <div v-if="pairs.length" class="flex flex-col gap-3">
      <div v-for="(pair, i) in pairs" :key="i" class="flex flex-col gap-1">
        <div v-if="pair.original" class="md-render text-[13px] text-zinc-800" v-html="render(pair.original)" />
        <div class="md-render text-[13px] text-zinc-400 border-l-2 border-brand/30 pl-3" v-html="render(pair.translated)" />
      </div>
    </div>

    <div v-else-if="!translating && currentDoc" class="text-center py-10 text-[12px] text-zinc-400">
      点「翻译全文」生成对照译文（按段落对齐，代码块保持原样）。
    </div>
    <div v-else-if="!currentDoc" class="text-center py-10 text-[12px] text-zinc-400">
      工作区还没有文档。
    </div>
  </div>
</template>
