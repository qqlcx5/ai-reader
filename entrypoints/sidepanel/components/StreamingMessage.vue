<script setup lang="ts">
import { ref, watch, nextTick, onBeforeUnmount } from 'vue';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

const props = defineProps<{
  content: string;
  isStreaming?: boolean;
}>();

const containerRef = ref<HTMLElement | null>(null);
const renderedHtml = ref('');

// Configure marked for safe rendering
marked.setOptions({
  breaks: true,
  gfm: true,
});

function renderMarkdown(text: string): string {
  try {
    const raw = marked.parse(text, { async: false }) as string;
    return DOMPurify.sanitize(raw, {
      ALLOWED_TAGS: [
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'p', 'br', 'hr',
        'ul', 'ol', 'li',
        'strong', 'em', 'del', 'code', 'pre',
        'a', 'img', 'blockquote',
        'table', 'thead', 'tbody', 'tr', 'th', 'td',
        'span', 'div',
        'input', // for task lists
      ],
      ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'target', 'class', 'type', 'checked', 'disabled'],
    });
  } catch {
    // If markdown parse fails, render as plain text with line breaks
    return text.replace(/\n/g, '<br>');
  }
}

// Watch content changes and re-render
watch(
  () => props.content,
  (val) => {
    renderedHtml.value = renderMarkdown(val);
    nextTick(() => {
      if (containerRef.value) {
        containerRef.value.scrollTop = containerRef.value.scrollHeight;
      }
    });
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  renderedHtml.value = '';
});
</script>

<template>
  <div
    ref="containerRef"
    role="region"
    aria-live="polite"
    aria-label="Streaming AI Response"
    class="streaming-message prose prose-sm max-w-none text-sm leading-relaxed"
    :class="{ 'cursor-blink': isStreaming }"
    v-html="renderedHtml"
  />
</template>

<style>
.streaming-message {
  word-break: break-word;
  overflow-wrap: break-word;
  padding-bottom: 2px;
}

.streaming-message :deep(h1),
.streaming-message :deep(h2),
.streaming-message :deep(h3),
.streaming-message :deep(h4) {
  margin-top: 1em;
  margin-bottom: 0.5em;
  font-weight: 600;
  color: #1f2937;
}

.streaming-message :deep(h1) { font-size: 1.25rem; }
.streaming-message :deep(h2) { font-size: 1.125rem; }
.streaming-message :deep(h3) { font-size: 1rem; }

.streaming-message :deep(p) {
  margin: 0.5em 0;
  color: #374151;
}

.streaming-message :deep(ul),
.streaming-message :deep(ol) {
  padding-left: 1.5em;
  margin: 0.5em 0;
}

.streaming-message :deep(li) {
  margin: 0.25em 0;
  color: #374151;
}

.streaming-message :deep(strong) {
  font-weight: 600;
  color: #1f2937;
}

.streaming-message :deep(code) {
  background: #f3f4f6;
  padding: 0.125em 0.375em;
  border-radius: 4px;
  font-size: 0.85em;
  font-family: 'SF Mono', 'Fira Code', monospace;
  color: #e11d48;
}

.streaming-message :deep(pre) {
  background: #1f2937;
  color: #f9fafb;
  padding: 0.75em 1em;
  border-radius: 8px;
  overflow-x: auto;
  margin: 0.75em 0;
}

.streaming-message :deep(pre code) {
  background: none;
  color: inherit;
  padding: 0;
  font-size: 0.8em;
}

.streaming-message :deep(blockquote) {
  border-left: 3px solid #3b82f6;
  padding-left: 0.75em;
  margin: 0.5em 0;
  color: #6b7280;
}

.streaming-message :deep(a) {
  color: #3b82f6;
  text-decoration: underline;
}

.streaming-message :deep(table) {
  border-collapse: collapse;
  width: 100%;
  margin: 0.75em 0;
  font-size: 0.85em;
}

.streaming-message :deep(th),
.streaming-message :deep(td) {
  border: 1px solid #e5e7eb;
  padding: 0.375em 0.75em;
  text-align: left;
}

.streaming-message :deep(th) {
  background: #f9fafb;
  font-weight: 600;
}

.streaming-message :deep(hr) {
  border: none;
  border-top: 1px solid #e5e7eb;
  margin: 1em 0;
}

.streaming-message :deep(img) {
  max-width: 100%;
  border-radius: 8px;
}
</style>
