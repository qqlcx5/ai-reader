<script lang="ts" setup>
/**
 * M4 — MessageList
 * 消息列表（含虚拟滚动）。使用 vue-virtual-scroller 的 RecycleScroller 提升长会话渲染性能。
 *
 * 验收要求：
 *   - 1000 条记录下 DOM 节点数稳定在 ~20 个（RecycleScroller 默认 pageMode=visible）
 */
import { computed } from 'vue';
import { RecycleScroller } from 'vue-virtual-scroller';
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css';
import UserMessage from './UserMessage.vue';
import ModelGrid from './ModelGrid.vue';
import type { Message, ModelResponseStatus } from '@/lib/workspace';
import type { ProviderConfig } from '@/modules/provider';

interface ProviderSlot {
  id: string;
  name: string;
  color?: string;
}

const props = defineProps<{
  messages: Message[];
  providers: ProviderConfig[];
  activeProviderIds: string[];
}>();

const emit = defineEmits<{
  (e: 'continue', payload: { providerId: string }): void;
  (e: 'abort', payload: { providerId: string }): void;
  (e: 'retry', payload: { providerId: string }): void;
}>();

// 把 activeProviderIds 解析成 provider slots（含 color）
const providerSlots = computed<ProviderSlot[]>(() => {
  return props.activeProviderIds
    .map((id) => props.providers.find((p) => p.id === id))
    .filter((p): p is ProviderConfig => Boolean(p))
    .map((p) => ({
      id: p.id,
      name: p.name,
      color: colorFor(p.type),
    }));
});

function colorFor(type: ProviderConfig['type']): string {
  switch (type) {
    case 'openai':
      return '#10a37f';
    case 'anthropic':
      return '#cc785c';
    case 'gemini':
      return '#248a52';
    default:
      return '#5b60e5';
  }
}

// 为 ModelGrid 准备 provider 列表：按 response 涉及的所有 provider 来取
function providersFor(responses: ModelResponseStatus[]): ProviderSlot[] {
  if (responses.length === 0) return providerSlots.value;
  const ids = new Set(responses.map((r) => r.providerId));
  return providerSlots.value.filter((p) => ids.has(p.id));
}

const scrollerItems = computed(() => props.messages);

// RecycleScroller v2 需要静态 itemSize；按 assistant 含 4 个 model 平均估高
const ITEM_SIZE = 320;
</script>

<template>
  <div class="message-list">
    <RecycleScroller
      v-if="scrollerItems.length > 0"
      class="scroller"
      :items="scrollerItems"
      :item-size="ITEM_SIZE"
      key-field="id"
      :min-item-size="80"
      v-slot="{ item }"
    >
      <div class="message-list__row">
        <UserMessage
          v-if="item.role === 'user'"
          :content="item.content || ''"
          :timestamp="item.createdAt"
        />
        <ModelGrid
          v-else
          :responses="item.modelResponses"
          :providers="providersFor(item.modelResponses)"
          @continue="(p) => emit('continue', p)"
          @abort="(p) => emit('abort', p)"
          @retry="(p) => emit('retry', p)"
        />
      </div>
    </RecycleScroller>
    <div v-else class="message-list__empty muted">
      还没有消息，发送第一条提问开始吧。
    </div>
  </div>
</template>

<style scoped>
.message-list {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 0 4px;
}

.scroller {
  flex: 1;
  min-height: 200px;
  overflow-y: auto;
}

.message-list__row {
  padding: 4px 8px;
}

.message-list__empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--fs-xs);
  font-style: italic;
  padding: 32px;
}
</style>
