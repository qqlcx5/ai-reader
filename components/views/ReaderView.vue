<script lang="ts" setup>
import { computed } from 'vue'
import { useArticleStore } from '@/stores/article.store'
import { useSettingsStore } from '@/stores/settings.store'
import SourceInfo from '../common/SourceInfo.vue'
import { renderMarkdown } from '@/utils/markdown-renderer'
import { AppError } from '@/domain'
import type { Article } from '@/domain'

const props = defineProps<{
  article: Article | null
  isPreview?: boolean
}>()

const emit = defineEmits<{
  back: []
  copy: []
  save: []
  delete: []
  confirmDelete: [articleId: string]
  showToast: [title: string, desc: string]
  showError: [message: string]
}>()

const articleStore = useArticleStore()
const settingsStore = useSettingsStore()

function formatDate(iso?: string): string {
  if (!iso) return '未知'
  const d = new Date(iso)
  return isNaN(d.getTime()) ? '未知' : d.toLocaleString('zh-CN', { hour12: false })
}

function readingTimeText(minutes?: number): string {
  if (minutes === undefined || minutes === null || Number.isNaN(minutes)) return '未知'
  const m = Math.max(1, Math.round(minutes))
  return `预计 ${m} 分钟`
}

const infoItems = computed(() => {
  if (!props.article) return []
  const a = props.article
  return [
    { label: '作者', value: a.author || '未知' },
    { label: '发布时间', value: formatDate(a.publishedAt) },
    { label: '阅读时间', value: readingTimeText(a.readingTime) },
    { label: '站点', value: a.siteName || '未知' },
    { label: '保存时间', value: formatDate(a.createdAt) },
  ]
})

function gridBorderRight(i: number): boolean {
  return i % 2 === 0 && i + 1 < infoItems.value.length
}
function gridBorderBottom(i: number): boolean {
  return Math.floor(i / 2) < Math.floor((infoItems.value.length - 1) / 2)
}

function onCopy() {
  if (!props.article) return
  try {
    navigator.clipboard.writeText(props.article.markdown)
    emit('showToast', 'Markdown 已复制', '可以粘贴到 Notion、Obsidian')
    emit('copy')
  } catch (err) {
    emit('showError', '当前环境不允许复制')
    throw new AppError('CLIPBOARD_FAILED', '当前环境不允许复制', err as Error)
  }
}

function onDeleteClick() {
  if (!props.article) return
  emit('confirmDelete', props.article.id)
}

async function onSave() {
  if (!props.article) return
  try {
    await articleStore.saveArticle(props.article)
    emit('save')
    emit('showToast', '已保存到本地文章库', props.article.title)
  } catch (err) {
    const message = err instanceof AppError ? err.toUserMessage() : '保存失败'
    emit('showError', message)
    throw new AppError('INDEXEDDB_FAILED', '保存失败', err as Error)
  }
}

function renderedMarkdown(md: string): string {
  try {
    return renderMarkdown(md)
  } catch (err) {
    emit('showError', 'Markdown 渲染失败')
    throw new AppError('MARKDOWN_FAILED', 'Markdown 渲染失败', err as Error)
  }
}
</script>

<template>
  <section class="h-full overflow-auto pb-3.5">
    <div
      v-if="props.article"
      :class="settingsStore.settings.readerStyle ? 'reader-style' : ''"
      class="p-3.5 rounded-20px"
      style="border: 1px solid rgba(29,29,31,0.08); background: rgba(255,255,255,0.78); backdrop-filter: blur(24px); box-shadow: inset 0 1px 0 rgba(255,255,255,0.72), 0 1px 2px rgba(0,0,0,0.04)"
    >
      <!-- Preview badge -->
      <div
        v-if="props.isPreview"
        class="mb-3.5 px-3 py-1.5 inline-flex items-center rounded-12px text-11px font-bold"
        style="border: 1px solid rgba(59,130,246,0.2); background: rgba(59,130,246,0.1); color: #2563eb"
      >
        预览中
      </div>

      <!-- Top actions -->
      <div class="flex items-center justify-between gap-2.5 mb-3.5">
        <button
          class="h-32px px-3 rounded-12px border border-rgba(29,29,31,0.08) bg-white/72 text-#3f3f46 text-12px font-semibold cursor-pointer transition-all hover:bg-white hover:-translate-y-px"
          @click="emit('back')"
        >
          ← 文章库
        </button>
        <div class="flex gap-2">
          <button
            class="h-32px px-2.5 rounded-12px border border-rgba(29,29,31,0.08) bg-white/72 text-#3f3f46 text-12px font-semibold cursor-pointer transition-all hover:bg-white hover:-translate-y-px"
            @click="onCopy"
          >
            复制
          </button>
          <button
            v-if="!props.isPreview"
            class="h-32px px-2.5 rounded-14px border text-#dc2626 text-12px font-semibold cursor-pointer transition-all hover:-translate-y-px"
            style="border-color: rgba(220,38,38,0.15); background: rgba(254,242,242,0.76)"
            @click="onDeleteClick"
          >
            删除
          </button>
          <button
            v-else
            class="h-32px px-2.5 rounded-14px border text-#16a34a text-12px font-semibold cursor-pointer transition-all hover:-translate-y-px"
            style="border-color: rgba(22,163,74,0.2); background: rgba(220,252,231,0.76)"
            @click="onSave"
          >
            保存
          </button>
        </div>
      </div>

      <SourceInfo
        :letter="props.article.siteLetter ?? (props.article.siteName?.[0] ?? '?').toUpperCase()"
        :site-name="props.article.siteName ?? ''"
        :url="props.article.url"
      />

      <h1 class="m-0 text-25px leading-tight font-bold tracking-tight text-#111">
        {{ props.article.title }}
      </h1>

      <!-- Info Grid -->
      <div
        class="mt-4 grid grid-cols-2 rounded-18px overflow-hidden"
        style="border: 1px solid rgba(29,29,31,0.08); background: rgba(255,255,255,0.62)"
      >
        <div
          v-for="(item, i) in infoItems"
          :key="i"
          class="p-3"
          :style="{
            borderRight: gridBorderRight(i) ? '1px solid rgba(29,29,31,0.08)' : 'none',
            borderBottom: gridBorderBottom(i) ? '1px solid rgba(29,29,31,0.08)' : 'none',
          }"
        >
          <div class="mb-1 text-10px text-#a1a1aa">{{ item.label }}</div>
          <div class="text-12px font-semibold text-#3f3f46 whitespace-nowrap overflow-hidden text-ellipsis">
            {{ item.value }}
          </div>
        </div>
      </div>

      <!-- Markdown Content -->
      <div
        class="mt-3.5 text-#2f3338 text-13px leading-relaxed"
        :class="settingsStore.settings.readerStyle
          ? 'p-4 rounded-20px'
          : 'p-1'"
        :style="settingsStore.settings.readerStyle
          ? { border: '1px solid rgba(29,29,31,0.08)', background: 'rgba(255,255,255,0.76)', boxShadow: '0 10px 30px rgba(0,0,0,0.08)' }
          : {}"
        v-html="renderedMarkdown(props.article.markdown)"
      />
    </div>

    <!-- Empty state -->
    <div v-else class="p-7 text-center text-#6e6e73">
      <div class="text-14px font-bold text-#27272a">还没有可阅读的文章</div>
      <div class="mt-1.5 text-12px">先保存一篇网页，再进入阅读器。</div>
    </div>
  </section>
</template>

<style scoped>
.reader-style :deep(h1) {
  margin: 22px 0 10px;
  color: #111;
  font-size: 22px;
  line-height: 1.25;
  letter-spacing: -0.035em;
}
.reader-style :deep(h1:first-child) {
  margin-top: 0;
}
.reader-style :deep(h2) {
  margin: 18px 0 8px;
  color: #111;
  font-size: 18px;
  line-height: 1.25;
  letter-spacing: -0.035em;
}
.reader-style :deep(h2:first-child) {
  margin-top: 0;
}
.reader-style :deep(h3) {
  margin: 16px 0 8px;
  color: #111;
  font-size: 16px;
  line-height: 1.3;
  letter-spacing: -0.03em;
}
.reader-style :deep(h3:first-child) {
  margin-top: 0;
}
.reader-style :deep(a) {
  color: #2563eb;
  text-decoration: none;
}
.reader-style :deep(a:hover) {
  text-decoration: underline;
}
.reader-style :deep(p) {
  margin: 0 0 12px;
}
.reader-style :deep(ul) {
  margin: 0 0 12px;
  padding-left: 18px;
}
.reader-style :deep(li) {
  margin: 6px 0;
}
.reader-style :deep(ol) {
  margin: 0 0 12px;
  padding-left: 18px;
}
.reader-style :deep(blockquote) {
  margin: 12px 0;
  padding-left: 14px;
  border-left: 3px solid #e4e4e7;
  color: #6e6e73;
}
.reader-style :deep(code) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
  background: rgba(244, 244, 245, 0.8);
  padding: 2px 5px;
  border-radius: 6px;
}
.reader-style :deep(pre) {
  background: rgba(244, 244, 245, 0.8);
  border-radius: 12px;
  padding: 14px;
  overflow-x: auto;
  margin: 12px 0;
}
.reader-style :deep(pre code) {
  background: transparent;
  padding: 0;
  border-radius: 0;
}
.reader-style :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 12px 0;
}
.reader-style :deep(th), .reader-style :deep(td) {
  padding: 8px 10px;
  border: 1px solid #e4e4e7;
  text-align: left;
}
.reader-style :deep(th) {
  background: rgba(244, 244, 245, 0.8);
  font-weight: 600;
}
.reader-style :deep(img) {
  max-width: 100%;
  border-radius: 10px;
  margin: 12px 0;
}
.reader-style :deep(hr) {
  border: 0;
  border-top: 1px solid rgba(29, 29, 31, 0.1);
  margin: 16px 0;
}
.reader-style :deep(strong) {
  color: #111;
}
</style>
