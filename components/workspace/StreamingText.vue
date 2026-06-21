<script lang="ts" setup>
/**
 * M4 — StreamingText
 * 增量渲染文本：使用 rAF 节流避免长文本卡顿。
 * - 接收 content prop，对外暴露 update(delta) 方法以增量追加
 * - 当内容稳定（无新 delta）时缓存最终 HTML
 */
import { ref, computed, onUnmounted, watch } from 'vue';
import MarkdownIt from 'markdown-it';

const props = defineProps<{
  /** 初始内容（可选） */
  content?: string;
  /** 是否启用 Markdown 渲染（默认 true） */
  markdown?: boolean;
  /** class 透传 */
  textClass?: string;
}>();

const localContent = ref<string>(props.content ?? '');
const renderTick = ref(0); // 触发 rAF 重渲
let frameRequested = false;
let lastRendered = '';
let cachedHtml = '';

const md = new MarkdownIt({ html: false, linkify: true, breaks: true });

const html = computed(() => {
  // 依赖 renderTick 让 rAF 调度后能重算
  void renderTick.value;
  if (localContent.value === lastRendered && cachedHtml) return cachedHtml;
  if (props.markdown === false) {
    lastRendered = localContent.value;
    cachedHtml = escapeHtml(localContent.value);
    return cachedHtml;
  }
  lastRendered = localContent.value;
  cachedHtml = md.render(localContent.value);
  return cachedHtml;
});

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** 对外暴露：追加一段 delta，并按 rAF 节流触发渲染 */
function append(delta: string) {
  localContent.value += delta;
  scheduleRender();
}

function setContent(next: string) {
  localContent.value = next;
  scheduleRender();
}

function scheduleRender() {
  if (frameRequested) return;
  frameRequested = true;
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(() => {
      frameRequested = false;
      renderTick.value++;
    });
  } else {
    setTimeout(() => {
      frameRequested = false;
      renderTick.value++;
    }, 16);
  }
}

watch(
  () => props.content,
  (next) => {
    if (typeof next === 'string' && next !== localContent.value) {
      setContent(next);
    }
  },
);

onUnmounted(() => {
  frameRequested = false;
});

defineExpose({ append, setContent });
</script>

<template>
  <div
    class="streaming-text markdown-content"
    :class="props.textClass"
    v-html="html"
  ></div>
</template>

<style scoped>
.streaming-text {
  font-size: var(--fs-xs);
  line-height: 1.65;
  color: var(--text);
  word-break: break-word;
  overflow-wrap: anywhere;
}

.streaming-text :deep(h1) {
  font-size: var(--fs-base);
  font-weight: 800;
  margin: 12px 0 6px;
  padding-bottom: 4px;
  border-bottom: 1px solid var(--border);
}

.streaming-text :deep(h2) {
  font-size: var(--fs-sm);
  font-weight: 700;
  margin: 10px 0 4px;
}

.streaming-text :deep(h3) {
  font-size: var(--fs-xs);
  font-weight: 700;
  margin: 8px 0 4px;
}

.streaming-text :deep(p) {
  margin: 0 0 8px;
  line-height: 1.7;
}

.streaming-text :deep(ul),
.streaming-text :deep(ol) {
  margin: 0 0 8px;
  padding-left: 20px;
}

.streaming-text :deep(li) {
  margin: 2px 0;
}

.streaming-text :deep(pre) {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 8px 10px;
  font-family: var(--font-mono);
  font-size: var(--fs-11);
  overflow-x: auto;
  margin: 6px 0;
}

.streaming-text :deep(code) {
  background: var(--card);
  color: var(--primary);
  border-radius: 4px;
  padding: 1px 4px;
  font-family: var(--font-mono);
  font-size: var(--fs-11);
  font-weight: 700;
}

.streaming-text :deep(pre code) {
  background: transparent;
  color: inherit;
  padding: 0;
  font-weight: 400;
}

.streaming-text :deep(blockquote) {
  border-left: 3px solid var(--border-strong);
  margin: 6px 0;
  padding: 4px 10px;
  color: var(--muted);
}

.streaming-text :deep(a) {
  color: var(--primary);
}
</style>
