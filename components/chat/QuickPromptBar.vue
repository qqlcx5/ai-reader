<script lang="ts" setup>
/**
 * M4 — QuickPromptBar
 * 6 个快捷指令按钮（text-[10px]，带下划线）。
 * 点击后将对应 Prompt 填入输入框，由用户确认。
 * 另有「圆桌交锋」/「串联接力」两个工作流快捷按钮。
 */
const emit = defineEmits<{
  (e: 'quick-prompt', payload: { prompt: string; autoSend?: boolean }): void
  (e: 'shortcut', payload: { type: 'roundtable' | 'relay' }): void
}>()

const QUICK_PROMPTS = [
  { label: '📋 总结摘要', prompt: '请用三段话概括这篇文章的核心论点，每段不超过 100 字。' },
  { label: '💡 解释概念', prompt: '请提取并解释这篇文章中所有重要的专业术语和关键概念，用通俗易懂的语言说明。' },
  { label: '🎯 核心观点', prompt: '请提取作者在文章中最想表达的 3～5 个核心观点，并为每个观点找出文章中的具体支撑段落。' },
  { label: '🌐 翻译中文', prompt: '请将这篇文章全文翻译为地道的简体中文，保留原有的段落结构和格式排版。' },
  { label: '🔬 红队批判', prompt: '请以批判性思维审视这篇文章，指出其中的逻辑漏洞、论据不足之处，以及可能存在的偏见或错误假设。' },
  { label: '🗺️ 脉络大纲', prompt: '请为这篇文章生成一份完整的章节级结构大纲，使用 Markdown 格式，清晰展示文章的论述脉络。' },
]
</script>

<template>
  <div class="qpb">
    <div class="qpb__prompts">
      <button
        v-for="item in QUICK_PROMPTS"
        :key="item.label"
        class="qpb__btn"
        type="button"
        @click="emit('quick-prompt', { prompt: item.prompt, autoSend: false })"
      >{{ item.label }}</button>
    </div>
    <div class="qpb__divider"></div>
    <div class="qpb__workflows">
      <button
        class="qpb__workflow-btn"
        type="button"
        @click="emit('shortcut', { type: 'roundtable' })"
      >圆桌交锋 →</button>
      <button
        class="qpb__workflow-btn"
        type="button"
        @click="emit('shortcut', { type: 'relay' })"
      >串联接力 →</button>
    </div>
  </div>
</template>

<style scoped>
.qpb {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px 6px;
  flex-wrap: wrap;
}

.qpb__prompts {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  flex: 1;
}

.qpb__btn {
  font-size: 10px;
  font-weight: 600;
  color: var(--muted, #7a7568);
  background: transparent;
  border: none;
  padding: 1px 0;
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 2px;
  text-decoration-color: var(--border, #e6e2d8);
  transition: color 100ms ease-out;
  white-space: nowrap;
}

.qpb__btn:hover {
  color: var(--primary, #5b60e5);
  text-decoration-color: var(--primary, #5b60e5);
}

.qpb__divider {
  width: 1px;
  height: 14px;
  background: var(--border, #e6e2d8);
  flex-shrink: 0;
}

.qpb__workflows {
  display: flex;
  gap: 4px;
}

.qpb__workflow-btn {
  font-size: 10px;
  font-weight: 700;
  color: var(--primary, #5b60e5);
  background: transparent;
  border: none;
  padding: 1px 0;
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 2px;
  text-decoration-color: #d2d6ff;
  transition: color 100ms ease-out;
  white-space: nowrap;
}

.qpb__workflow-btn:hover {
  color: var(--primary, #5b60e5);
  opacity: 0.75;
}
</style>
