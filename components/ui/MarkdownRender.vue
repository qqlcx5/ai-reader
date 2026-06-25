<script lang="ts" setup>
import { computed } from 'vue';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import hljs from 'highlight.js';
import 'highlight.js/styles/github.css';

const props = defineProps<{ content: string }>();

const html = computed(() => {
  if (!props.content) return '';
  // marked v15+ 移除了 setOptions 中的 highlight，需要用 use 扩展
  marked.use({
    gfm: true,
    breaks: true,
    renderer: undefined,
  });
  // 自定义代码块渲染
  marked.use({
    walkTokens: (token) => {
      if (token.type === 'code') {
        const code = (token as { text: string; lang?: string }).text;
        const lang = (token as { text: string; lang?: string }).lang;
        if (lang && hljs.getLanguage(lang)) {
          try {
            (token as { text: string }).text = hljs.highlight(code, { language: lang }).value;
          } catch {
            // ignore
          }
        } else {
          try {
            (token as { text: string }).text = hljs.highlightAuto(code).value;
          } catch {
            // ignore
          }
        }
      }
    },
  });
  const raw = marked.parse(props.content) as string;
  return DOMPurify.sanitize(raw, {
    ADD_ATTR: ['target'],
  });
});
</script>

<template>
  <!-- eslint-disable-next-line vue/no-v-html -->
  <div class="markdown" v-html="html"></div>
</template>

<style scoped>
.markdown {
  font-size: 13px;
  line-height: 1.6;
  word-wrap: break-word;
}

.markdown :deep(h1),
.markdown :deep(h2),
.markdown :deep(h3),
.markdown :deep(h4) {
  margin: 12px 0 6px;
  font-weight: 600;
}
.markdown :deep(h1) { font-size: 18px; }
.markdown :deep(h2) { font-size: 16px; }
.markdown :deep(h3) { font-size: 14px; }
.markdown :deep(h4) { font-size: 13px; }

.markdown :deep(p) {
  margin: 6px 0;
}

.markdown :deep(ul),
.markdown :deep(ol) {
  margin: 6px 0;
  padding-left: 20px;
}

.markdown :deep(li) {
  margin: 2px 0;
}

.markdown :deep(code) {
  background: rgba(0, 0, 0, 0.05);
  padding: 1px 4px;
  border-radius: 3px;
  font-family: 'SF Mono', Menlo, Consolas, monospace;
  font-size: 12px;
}
@media (prefers-color-scheme: dark) {
  .markdown :deep(code) {
    background: rgba(255, 255, 255, 0.1);
  }
}

.markdown :deep(pre) {
  background: rgba(0, 0, 0, 0.05);
  padding: 8px;
  border-radius: 6px;
  overflow-x: auto;
  margin: 8px 0;
}
@media (prefers-color-scheme: dark) {
  .markdown :deep(pre) {
    background: rgba(255, 255, 255, 0.05);
  }
}

.markdown :deep(pre code) {
  background: transparent;
  padding: 0;
  font-size: 12px;
}

.markdown :deep(a) {
  color: var(--color-primary);
  text-decoration: none;
}
.markdown :deep(a:hover) {
  text-decoration: underline;
}

.markdown :deep(blockquote) {
  margin: 6px 0;
  padding: 4px 12px;
  border-left: 3px solid var(--color-border);
  color: var(--color-text-secondary);
}

.markdown :deep(table) {
  border-collapse: collapse;
  margin: 8px 0;
  width: 100%;
  font-size: 12px;
}
.markdown :deep(th),
.markdown :deep(td) {
  border: 1px solid var(--color-border);
  padding: 4px 8px;
}
.markdown :deep(th) {
  background: var(--color-bg-secondary);
  font-weight: 600;
}

.markdown :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: 4px;
}
</style>
