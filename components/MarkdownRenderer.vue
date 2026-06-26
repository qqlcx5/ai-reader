<script setup lang="ts">
import { ref, watch, nextTick, computed } from 'vue';
import DOMPurify from 'dompurify';
import hljs from 'highlight.js';

const props = defineProps<{
  content: string;
}>();

const containerRef = ref<HTMLElement | null>(null);

const sanitizedHtml = computed(() => {
  const rawHtml = renderMarkdown(props.content);
  return DOMPurify.sanitize(rawHtml, {
    ADD_TAGS: ['iframe'],
    ADD_ATTR: ['target', 'rel'],
  });
});

function renderMarkdown(text: string): string {
  // 简单 Markdown 渲染（不依赖外部库）
  let html = text;

  // 代码块
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_match, lang, code) => {
    const highlighted = lang && hljs.getLanguage(lang)
      ? hljs.highlight(code.trim(), { language: lang }).value
      : hljs.highlightAuto(code.trim()).value;
    return `<pre class="hljs"><code class="language-${lang || 'auto'}">${highlighted}</code></pre>`;
  });

  // 行内代码
  html = html.replace(/`([^`]+)`/g, '<code class="bg-slate-100 px-1 py-0.5 rounded text-sm font-mono text-red-600">$1</code>');

  // 标题
  html = html.replace(/^### (.+)$/gm, '<h3 class="text-base font-semibold mt-4 mb-2">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 class="text-lg font-semibold mt-4 mb-2">$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1 class="text-xl font-bold mt-4 mb-2">$1</h1>');

  // 粗体和斜体
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // 链接
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener" class="text-brand-600 hover:underline">$1</a>');

  // 图片
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" class="max-w-full rounded my-2" loading="lazy" />');

  // 无序列表
  html = html.replace(/^[-*] (.+)$/gm, '<li class="ml-4">$1</li>');
  html = html.replace(/(<li[^>]*>.*<\/li>\n?)+/g, '<ul class="list-disc my-2">$&</ul>');

  // 有序列表
  html = html.replace(/^\d+\. (.+)$/gm, '<li class="ml-4">$1</li>');

  // 分隔线
  html = html.replace(/^---+$/gm, '<hr class="border-slate-200 my-4" />');

  // 段落（换行转 <br>）
  html = html.replace(/\n\n/g, '</p><p class="my-2">');
  html = html.replace(/\n/g, '<br />');

  // 表格（简单支持）
  html = html.replace(/\|(.+)\|/g, (_match, content) => {
    const cells = content.split('|').map((c: string) => c.trim());
    if (cells.every((c: string) => /^[-:]+$/.test(c))) return ''; // 分隔行
    const tag = 'td';
    const row = cells.map((c: string) => `<${tag} class="px-3 py-1.5 border border-slate-200">${c}</${tag}>`).join('');
    return `<tr>${row}</tr>`;
  });
  html = html.replace(/(<tr>.*<\/tr>\n?)+/g, '<table class="border-collapse my-2 text-sm">$&</table>');

  return `<p class="my-2">${html}</p>`;
}

// 自动滚动到底部
watch(() => props.content, async () => {
  await nextTick();
  if (containerRef.value) {
    containerRef.value.scrollTop = containerRef.value.scrollHeight;
  }
});
</script>

<template>
  <div ref="containerRef" class="markdown-body text-sm leading-relaxed" v-html="sanitizedHtml" />
</template>

<style scoped>
.markdown-body :deep(pre) {
  padding: 0.75rem;
  border-radius: 0.375rem;
  overflow-x: auto;
  margin: 0.5rem 0;
  font-size: 0.8125rem;
}

.markdown-body :deep(table) {
  width: 100%;
}

.markdown-body :deep(a) {
  color: #6366f1;
}
</style>
