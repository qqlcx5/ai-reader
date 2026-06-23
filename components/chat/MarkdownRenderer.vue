<script lang="ts" setup>
/**
 * M4 — MarkdownRenderer
 * 使用 markdown-it 渲染，对已完成消息缓存 HTML（computed + 内容比较），避免重复 render。
 * 注意：XSS 防护通过 markdown-it 的 html:false 选项实现，不依赖外部净化库。
 */
import { computed, ref } from 'vue'
import MarkdownIt from 'markdown-it'

const props = defineProps<{
  content: string
  /** 是否已完成（完成的消息才缓存 HTML） */
  done?: boolean
}>()

const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
  typographer: false,
})

// 缓存已完成消息的 HTML
let _cachedContent = ''
let _cachedHtml = ''

const renderedHtml = computed<string>(() => {
  if (!props.content) return ''
  // 如果内容未变化，直接返回缓存
  if (props.content === _cachedContent && _cachedHtml) return _cachedHtml
  const html = md.render(props.content)
  // 只对已完成消息缓存（流式进行中不缓存）
  if (props.done) {
    _cachedContent = props.content
    _cachedHtml = html
  }
  return html
})
</script>

<template>
  <div class="markdown-content" v-html="renderedHtml"></div>
</template>

<style scoped>
.markdown-content {
  font-size: var(--fs-xs, 12px);
  line-height: 1.7;
  color: var(--text, #2e2d2a);
  word-break: break-word;
  overflow-wrap: anywhere;
}

.markdown-content :deep(h1) {
  font-size: var(--fs-base, 14px);
  font-weight: 800;
  margin: 14px 0 6px;
  padding-bottom: 4px;
  border-bottom: 1px solid var(--border, #e6e2d8);
}

.markdown-content :deep(h2) {
  font-size: var(--fs-sm, 13px);
  font-weight: 700;
  margin: 12px 0 4px;
}

.markdown-content :deep(h3) {
  font-size: var(--fs-xs, 12px);
  font-weight: 700;
  margin: 10px 0 4px;
}

.markdown-content :deep(p) {
  margin: 0 0 8px;
  line-height: 1.7;
}

.markdown-content :deep(ul),
.markdown-content :deep(ol) {
  margin: 0 0 8px;
  padding-left: 20px;
}

.markdown-content :deep(li) {
  margin: 2px 0;
  line-height: 1.6;
}

.markdown-content :deep(pre) {
  background: var(--card, #faf9f5);
  border: 1px solid var(--border, #e6e2d8);
  border-radius: 8px;
  padding: 10px 12px;
  font-family: var(--font-mono, monospace);
  font-size: 11px;
  overflow-x: auto;
  margin: 8px 0;
}

.markdown-content :deep(code) {
  background: var(--card, #faf9f5);
  color: var(--primary, #5b60e5);
  border-radius: 4px;
  padding: 1px 5px;
  font-family: var(--font-mono, monospace);
  font-size: 11px;
  font-weight: 700;
}

.markdown-content :deep(pre code) {
  background: transparent;
  color: inherit;
  padding: 0;
  font-weight: 400;
}

.markdown-content :deep(blockquote) {
  border-left: 3px solid var(--border-strong, #cfc9bc);
  margin: 8px 0;
  padding: 4px 12px;
  color: var(--muted, #7a7568);
}

.markdown-content :deep(a) {
  color: var(--primary, #5b60e5);
  text-decoration: underline;
  text-underline-offset: 2px;
}

.markdown-content :deep(hr) {
  border: none;
  border-top: 1px solid var(--border, #e6e2d8);
  margin: 12px 0;
}

.markdown-content :deep(table) {
  border-collapse: collapse;
  width: 100%;
  margin: 8px 0;
  font-size: 11px;
}

.markdown-content :deep(th),
.markdown-content :deep(td) {
  border: 1px solid var(--border, #e6e2d8);
  padding: 4px 8px;
  text-align: left;
}

.markdown-content :deep(th) {
  background: var(--card, #faf9f5);
  font-weight: 700;
}
</style>
