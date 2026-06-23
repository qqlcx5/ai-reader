<script lang="ts" setup>
/**
 * M4 — PageSummaryCard
 * 对话第一条消息：展示 favicon + 标题 + 字数 + 提取引擎 badge。
 * 默认折叠，点击"展开查看提取正文"展开显示完整 Markdown 正文。
 * 展开动画：max-height 从 0 → auto，150ms ease-out。
 */
import { ref } from 'vue'
import MarkdownRenderer from './MarkdownRenderer.vue'

const props = defineProps<{
  title: string
  url: string
  favicon?: string
  wordCount: number
  engine: 'readability' | 'defuddle' | 'fallback'
  rawText?: string
  markdownText?: string
}>()

const isExpanded = ref(false)

const fullText = props.markdownText || props.rawText || ''

function toggleExpand(): void {
  isExpanded.value = !isExpanded.value
}

const ENGINE_LABEL: Record<string, string> = {
  readability: 'Readability',
  defuddle: 'Defuddle',
  fallback: 'Fallback',
}

function formatWordCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K 字`
  return `${n} 字`
}
</script>

<template>
  <div class="psc">
    <div class="psc__header">
      <img
        v-if="favicon"
        class="psc__favicon"
        :src="favicon"
        :alt="title"
        @error="($event.target as HTMLImageElement).style.display = 'none'"
      />
      <div v-else class="psc__favicon-placeholder">📄</div>
      <div class="psc__meta">
        <span class="psc__title" :title="title">{{ title }}</span>
        <div class="psc__badges">
          <span class="psc__badge psc__badge--words">{{ formatWordCount(wordCount) }}</span>
          <span class="psc__badge psc__badge--engine">{{ ENGINE_LABEL[engine] }}</span>
          <span class="psc__badge psc__badge--no-truncation">No Truncation</span>
        </div>
      </div>
      <button
        v-if="fullText"
        class="psc__toggle"
        type="button"
        @click="toggleExpand"
      >
        {{ isExpanded ? '收起' : '展开正文' }}
        <span class="psc__toggle-icon" :class="{ 'psc__toggle-icon--open': isExpanded }">▾</span>
      </button>
    </div>

    <!-- 展开内容区 -->
    <div class="psc__body" :class="{ 'psc__body--expanded': isExpanded }">
      <div class="psc__content">
        <MarkdownRenderer :content="fullText" :done="true" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.psc {
  margin: 8px 12px;
  background: var(--card, #faf9f5);
  border: 1px solid var(--border, #e6e2d8);
  border-radius: 12px;
  overflow: hidden;
}

.psc__header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
}

.psc__favicon {
  width: 20px;
  height: 20px;
  border-radius: 4px;
  flex-shrink: 0;
  object-fit: contain;
}

.psc__favicon-placeholder {
  width: 20px;
  height: 20px;
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.psc__meta {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.psc__title {
  font-size: 12px;
  font-weight: 700;
  color: var(--text, #2e2d2a);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.psc__badges {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.psc__badge {
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 1px 5px;
  border-radius: 4px;
}

.psc__badge--words {
  background: var(--primary-soft, #f0f1fe);
  color: var(--primary, #5b60e5);
}

.psc__badge--engine {
  background: var(--card, #faf9f5);
  color: var(--muted, #7a7568);
  border: 1px solid var(--border, #e6e2d8);
}

.psc__badge--no-truncation {
  background: var(--green-soft, #eefaf2);
  color: var(--green, #248a52);
}

.psc__toggle {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 10px;
  font-weight: 700;
  color: var(--muted, #7a7568);
  background: transparent;
  border: none;
  cursor: pointer;
  white-space: nowrap;
  padding: 4px 6px;
  border-radius: 6px;
  transition: color 100ms ease-out;
}

.psc__toggle:hover {
  color: var(--primary, #5b60e5);
}

.psc__toggle-icon {
  display: inline-block;
  transition: transform 150ms ease-out;
  font-size: 12px;
}

.psc__toggle-icon--open {
  transform: rotate(180deg);
}

/* 展开/收起动画 */
.psc__body {
  max-height: 0;
  overflow: hidden;
  transition: max-height 150ms ease-out;
}

.psc__body--expanded {
  max-height: 600px;
  overflow-y: auto;
}

.psc__content {
  padding: 12px 14px;
  border-top: 1px solid var(--border, #e6e2d8);
}
</style>
