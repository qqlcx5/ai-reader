<script lang="ts" setup>
import { ref, computed, watch } from 'vue'
import type { SavedArticle } from '../../shared/domain'
import {
  exportArticleObsidian,
  exportMindMap,
  copyToClipboard,
  downloadFile,
  listVariants,
  t,
} from '../../core/export'
import type { ObsidianExportOptions, ExportResult, MindMapFormat, VariantMeta } from '../../core/export'

const props = defineProps<{
  article: SavedArticle | null
  /** Whether to show batch export controls */
  batchMode?: boolean
  /** All articles for batch export */
  articles?: SavedArticle[]
}>()

const emit = defineEmits<{
  showToast: [title: string, desc: string]
  close: []
}>()

// ---- State ----

const format = ref<'obsidian' | 'mdx' | 'json'>('obsidian')
const variantId = ref('default')
const preview = ref('')
const filename = ref('')

const variants = ref<VariantMeta[]>(listVariants())
const selectedVariant = computed(() => variants.value.find(v => v.id === variantId.value))

const formatLabel = computed(() => {
  switch (format.value) {
    case 'obsidian': return t('export.format_obsidian')
    case 'mdx': return t('export.format_mdx')
    case 'json': return t('export.format_json')
  }
})

// ---- Generate ----

function generateExport(): ExportResult | string | null {
  if (!props.article) return null

  if (format.value === 'obsidian') {
    const opts: ObsidianExportOptions = { variant: variantId.value }
    return exportArticleObsidian(props.article, opts)
  }

  return exportMindMap(props.article, { format: format.value as MindMapFormat })
}

watch(
  [() => props.article, format, variantId],
  () => {
    const result = generateExport()
    if (!result) {
      preview.value = ''
      filename.value = ''
      return
    }
    if (typeof result === 'string') {
      preview.value = result.slice(0, 3000)
      filename.value = props.article
        ? `${props.article.title.slice(0, 50)}.${format.value === 'json' ? 'json' : 'mdx'}`
        : 'export'
      return
    }
    preview.value = result.content.slice(0, 3000)
    filename.value = result.filename
  },
  { immediate: true },
)

// ---- Actions ----

async function handleDownload() {
  const result = generateExport()
  if (!result) return

  const content = typeof result === 'string' ? result : result.content
  const name = typeof result === 'string' ? filename.value : result.filename

  downloadFile(name, content)
  emit('showToast', t('export.export_success'), name)
}

async function handleCopy() {
  const result = generateExport()
  if (!result) return

  const content = typeof result === 'string' ? result : result.content
  const ok = await copyToClipboard(content)
  if (ok) {
    emit('showToast', t('export.copy_success'), '')
  } else {
    emit('showToast', t('export.copy_failed'), '')
  }
}

async function handleBatchExport() {
  if (!props.articles || props.articles.length === 0) return

  for (const article of props.articles) {
    if (format.value === 'obsidian') {
      const r = exportArticleObsidian(article, { variant: variantId.value })
      downloadFile(r.filename, r.content)
    } else {
      const r = exportMindMap(article, { format: format.value as MindMapFormat })
      const ext = format.value === 'json' ? 'json' : 'mdx'
      downloadFile(`${article.title.slice(0, 50)}.${ext}`, r)
    }
    // Small delay between downloads to avoid browser throttling
    await new Promise((r) => setTimeout(r, 300))
  }
  emit('showToast', t('export.export_success'), `${props.articles.length} 个文件`)
}
</script>

<template>
  <div class="flex flex-col h-full bg-white">
    <!-- Header -->
    <div class="flex items-center justify-between px-4 py-3 border-b border-gray-100 flex-shrink-0">
      <h3 class="text-sm font-bold text-gray-900">{{ t('export.title') }}</h3>
      <button
        class="text-gray-400 hover:text-gray-600 bg-transparent border-0 cursor-pointer p-1"
        @click="emit('close')"
      >
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
      </button>
    </div>

    <!-- Controls -->
    <div class="p-4 space-y-3 border-b border-gray-50 flex-shrink-0">
      <!-- Format Selector -->
      <div>
        <label class="text-11px font-semibold text-gray-500 block mb-1.5">{{ t('export.format') }}</label>
        <div class="flex gap-1.5">
          <button
            v-for="fmt in (['obsidian', 'mdx', 'json'] as const)"
            :key="fmt"
            :class="[
              'px-3 py-1.5 rounded-lg text-11px font-medium border transition cursor-pointer',
              format === fmt
                ? 'bg-blue-50 border-blue-200 text-blue-700'
                : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100',
            ]"
            @click="format = fmt"
          >
            {{ fmt === 'obsidian' ? t('export.format_obsidian') : fmt === 'mdx' ? 'MDX' : 'JSON' }}
          </button>
        </div>
      </div>

      <!-- Variant Selector (only for Obsidian) -->
      <div v-if="format === 'obsidian'">
        <label class="text-11px font-semibold text-gray-500 block mb-1.5">{{ t('export.variant') }}</label>
        <div class="flex gap-1.5 flex-wrap">
          <button
            v-for="v in variants"
            :key="v.id"
            :class="[
              'px-3 py-1.5 rounded-lg text-11px font-medium border transition cursor-pointer',
              variantId === v.id
                ? 'bg-purple-50 border-purple-200 text-purple-700'
                : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100',
            ]"
            :title="v.description"
            @click="variantId = v.id"
          >
            {{ v.name }}
          </button>
        </div>
        <p class="text-10px text-gray-400 mt-1">{{ selectedVariant?.description }}</p>
      </div>

      <!-- Batch Mode -->
      <div v-if="batchMode && articles && articles.length > 0" class="pt-1">
        <button
          class="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-semibold py-2 px-4 rounded-xl text-xs transition shadow-sm cursor-pointer border-0 flex items-center justify-center gap-1.5"
          @click="handleBatchExport"
        >
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          {{ t('export.batch_export_all', { count: articles.length }) }}
        </button>
      </div>
    </div>

    <!-- Preview -->
    <div class="flex-grow overflow-y-auto p-4" style="scrollbar-width: thin">
      <template v-if="article && preview">
        <div class="flex items-center justify-between mb-2">
          <span class="text-10px font-mono text-gray-400 truncate max-w-[200px]">{{ filename }}</span>
          <span class="text-10px text-gray-400">{{ formatLabel }} / {{ selectedVariant?.name || '-' }}</span>
        </div>

        <pre
          role="region"
          aria-label="Export Preview"
          class="text-11px font-mono leading-relaxed bg-gray-950 text-green-400 p-4 rounded-xl overflow-x-auto whitespace-pre-wrap break-all m-0"
        >{{ preview }}</pre>

        <!-- Truncation hint -->
        <p v-if="preview.length >= 3000" class="text-10px text-amber-500 mt-2 text-center">
          预览已截断至 3000 字符，下载文件包含完整内容
        </p>
      </template>

      <!-- Empty state -->
      <div v-else class="flex flex-col items-center justify-center h-full text-gray-400 py-10">
        <svg class="w-10 h-10 mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        <p class="text-xs font-semibold">{{ t('export.no_article') }}</p>
      </div>
    </div>

    <!-- Bottom Actions -->
    <div v-if="article" class="p-4 border-t border-gray-100 bg-gray-50 flex space-x-2 flex-shrink-0">
      <button
        class="flex-grow bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-xl text-xs transition flex items-center justify-center gap-1.5 shadow-sm cursor-pointer border-0"
        @click="handleDownload"
      >
        <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        {{ t('export.download') }}
      </button>
      <button
        class="flex-grow bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold py-2 px-4 rounded-xl text-xs transition cursor-pointer border-0 flex items-center justify-center gap-1.5"
        @click="handleCopy"
      >
        <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        {{ t('export.copy') }}
      </button>
    </div>
  </div>
</template>
