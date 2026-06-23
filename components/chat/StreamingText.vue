<script lang="ts" setup>
/**
 * M4 — StreamingText
 * 增量字符串追加，requestAnimationFrame 16ms 节流，流式结束前显示 .typing-cursor。
 * 流式结束后切换为 MarkdownRenderer 进行完整缓存渲染。
 */
import { ref, computed, onUnmounted, watch } from 'vue'
import MarkdownRenderer from './MarkdownRenderer.vue'

const props = defineProps<{
  /** 外部传入的初始/完整内容 */
  content?: string
  /** 是否流式结束（true 时切换到缓存渲染并隐藏光标） */
  done?: boolean
  /** 额外 CSS class */
  textClass?: string
}>()

const localContent = ref<string>(props.content ?? '')
let frameRequested = false

/** rAF 节流：约 16ms 批量合并 delta 后触发 computed 更新 */
const renderTick = ref(0)

const displayHtml = computed<string>(() => {
  void renderTick.value
  if (!localContent.value) return ''
  // 流式期间：直接 escape 纯文本，防止 markdown 频繁 re-parse 卡顿
  if (!props.done) return ''
  return ''
})

/** 对外暴露：追加一段 delta */
function append(delta: string): void {
  localContent.value += delta
  scheduleRender()
}

/** 对外暴露：覆盖整个内容 */
function setContent(next: string): void {
  localContent.value = next
  scheduleRender()
}

function scheduleRender(): void {
  if (frameRequested) return
  frameRequested = true
  const raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : (cb: () => void) => setTimeout(cb, 16)
  raf(() => {
    frameRequested = false
    renderTick.value++
  })
}

// 同步外部 content prop 变化（用于从 store 恢复历史）
watch(
  () => props.content,
  (next) => {
    if (typeof next === 'string' && next !== localContent.value) {
      setContent(next)
    }
  },
)

onUnmounted(() => {
  frameRequested = false
})

defineExpose({ append, setContent })
</script>

<template>
  <div class="streaming-text" :class="textClass">
    <!-- 已完成：使用 MarkdownRenderer 缓存渲染 -->
    <MarkdownRenderer v-if="done" :content="localContent" :done="true" />
    <!-- 流式进行中：直接显示纯文本 + 光标 -->
    <template v-else>
      <div class="streaming-text__raw">{{ localContent }}<span v-if="!done" class="typing-cursor"></span></div>
    </template>
  </div>
</template>

<style scoped>
.streaming-text {
  font-size: var(--fs-xs, 12px);
  line-height: 1.65;
  color: var(--text, #2e2d2a);
  word-break: break-word;
  overflow-wrap: anywhere;
  min-height: 20px;
}

.streaming-text__raw {
  white-space: pre-wrap;
  font-size: inherit;
  line-height: inherit;
}

/* 流式光标 */
.typing-cursor {
  display: inline-block;
  margin-left: 1px;
  vertical-align: middle;
  animation: pulse-cursor 1s infinite;
}

.typing-cursor::after {
  content: '▋';
  font-size: 0.9em;
  color: var(--primary, #5b60e5);
}

@keyframes pulse-cursor {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}
</style>
