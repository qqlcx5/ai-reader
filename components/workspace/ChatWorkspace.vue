<script lang="ts" setup>
/**
 * M4 — ChatWorkspace
 * 工作区根组件。组合：MessageList + InputComposer。
 *
 * 职责：
 *   - 维护当前会话（local refs 缓存，store 同步）
 *   - 触发多模型调度（runMultiModelChat）
 *   - 接收 delta / status / metrics 回调并增量更新 modelResponses
 *   - 中止时调用 abortAllRequests（M1 已有 ABORT_ALL 总线）
 */
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import MessageList from './MessageList.vue';
import InputComposer from './InputComposer.vue';
import { useSettingsStore } from '@/stores/settings.store';
import { useContextStore } from '@/stores/context.store';
import { useConversationStore } from '@/stores/conversation.store';
import { useUiStore } from '@/stores/ui.store';
import { abortAllRequests } from '@/modules/provider/abort-registry';
import { on as busOn, send as busSend, type CommandMessage } from '@/utils/command-bus';
import { runMultiModelChat } from '@/lib/workspace';
import type { Message, ModelResponseStatus, Conversation } from '@/lib/workspace';
import type { ExtractedContext } from '@/modules/extraction';

const settings = useSettingsStore();
const ctx = useContextStore();
const conversation = useConversationStore();
const ui = useUiStore();

/** 把 settings 层的 ProviderConfig（默认模型字段为 defaultModel）映射为 provider 层（model） */
function toProviderConfig(p: import('@/modules/storage').ProviderConfig): import('@/modules/provider').ProviderConfig {
  return {
    id: p.id,
    name: p.name,
    type: p.type,
    apiKey: p.apiKey,
    baseUrl: p.baseUrl,
    model: p.defaultModel ?? '',
    enabled: p.enabled ?? true,
  };
}

const props = defineProps<{
  /** 显式上下文（如 SidePanel 已提取的 currentContext），可覆盖 store */
  context?: ExtractedContext | null;
}>();

const selectedProviderIds = ref<string[]>([]);
const messages = ref<Message[]>([]);
const isStreaming = ref(false);
let unsubAbort: (() => void) | null = null;

const enabledProviders = computed(() =>
  settings.settings.providers.filter((p) => p.enabled).map(toProviderConfig),
);

const extContext = computed<ExtractedContext | null>(() => {
  if (props.context !== undefined) return props.context;
  const c = ctx.currentContext;
  if (!c.url) return null;
  return {
    url: c.url,
    title: c.title,
    siteName: '',
    extractedAt: Date.now(),
    wordCount: c.fullText?.length || c.excerpt?.length || 0,
    content: c.fullText || c.excerpt || '',
    format: 'text',
    extractor: 'readability',
  };
});

function ensureConversation(): Conversation {
  if (conversation.currentConversationId) {
    return {
      id: conversation.currentConversationId,
      title: '当前会话',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      activeProviderIds: selectedProviderIds.value,
      mode: 'chat',
    };
  }
  // 同步创建
  return {
    id: 'pending',
    title: '当前会话',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    activeProviderIds: selectedProviderIds.value,
    mode: 'chat',
  };
}

async function handleSend(payload: { text: string }) {
  if (isStreaming.value) return;
  if (selectedProviderIds.value.length === 0) return;
  const text = payload.text.trim();
  if (!text) return;

  // 1. 创建或重用会话
  let conv = conversation.currentConversationId;
  if (!conv) {
    const created = await conversation.createConversation({
      title: text.slice(0, 60),
      mode: 'chat',
      activeProviderIds: selectedProviderIds.value,
    });
    conv = created.id;
  }

  // 2. 写用户消息到 store
  const userMessage = await conversation.addUserMessage(conv, text);

  // 3. 同步到本地 messages
  const localUserMsg: Message = {
    id: userMessage.id,
    conversationId: userMessage.conversationId,
    parentId: userMessage.parentId || null,
    role: 'user',
    content: text,
    modelResponses: [],
    createdAt: userMessage.createdAt,
  };
  messages.value.push(localUserMsg);

  // 4. 构造 assistant 消息占位（每个 provider 一个 modelResponse）
  const assistantMsg: Message = {
    id: `assistant-${userMessage.id}`,
    conversationId: conv,
    parentId: userMessage.id,
    role: 'assistant',
    modelResponses: selectedProviderIds.value.map((pid) => ({
      providerId: pid,
      status: 'pending',
      content: '',
      metrics: null,
    })),
    createdAt: Date.now(),
  };
  messages.value.push(assistantMsg);

  isStreaming.value = true;

  // 5. 触发多模型调度
  const providers = enabledProviders.value.filter((p) => selectedProviderIds.value.includes(p.id));
  const convRecord: Conversation = {
    id: conv,
    title: '当前会话',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    activeProviderIds: selectedProviderIds.value,
    mode: 'chat',
  };

  await runMultiModelChat({
    conversation: convRecord,
    userMessage: localUserMsg,
    providers,
    context: extContext.value,
    callbacks: {
      onDelta: (pid, delta) => {
        const resp = findResponse(assistantMsg.id, pid);
        if (resp) {
          resp.content += delta;
          // 触发响应式：直接替换引用
          replaceResponse(assistantMsg.id, pid, { ...resp });
        }
      },
      onStatus: (pid, status) => {
        const resp = findResponse(assistantMsg.id, pid);
        if (resp) {
          resp.status = status;
          replaceResponse(assistantMsg.id, pid, { ...resp });
        }
      },
      onMetrics: (pid, metrics) => {
        const resp = findResponse(assistantMsg.id, pid);
        if (resp) {
          resp.metrics = metrics;
          replaceResponse(assistantMsg.id, pid, { ...resp });
        }
      },
      onError: (pid, err) => {
        const resp = findResponse(assistantMsg.id, pid);
        if (resp) {
          resp.error = err;
          replaceResponse(assistantMsg.id, pid, { ...resp });
        }
      },
    },
  });

  isStreaming.value = false;
}

function findResponse(messageId: string, providerId: string): ModelResponseStatus | undefined {
  const m = messages.value.find((x) => x.id === messageId);
  if (!m) return undefined;
  return m.modelResponses.find((r) => r.providerId === providerId);
}

function replaceResponse(messageId: string, providerId: string, next: ModelResponseStatus) {
  const m = messages.value.find((x) => x.id === messageId);
  if (!m) return;
  const idx = m.modelResponses.findIndex((r) => r.providerId === providerId);
  if (idx === -1) return;
  m.modelResponses.splice(idx, 1, next);
}

function handleAbort() {
  abortAllRequests('USER_ABORT');
  // 把所有正在 streaming 的 modelResponse 标为 aborted
  for (const m of messages.value) {
    for (const r of m.modelResponses) {
      if (r.status === 'pending' || r.status === 'streaming') {
        r.status = 'aborted';
      }
    }
  }
  isStreaming.value = false;
}

function handleContinueFromCard(payload: { providerId: string }) {
  // 简化：发送一条「继续」指令到当前最后一条 assistant
  const lastAssistant = [...messages.value].reverse().find((m) => m.role === 'assistant');
  if (!lastAssistant) return;
  const resp = lastAssistant.modelResponses.find((r) => r.providerId === payload.providerId);
  if (!resp) return;
  const text = `请基于你此前的回答继续：\n\n${resp.content.slice(-2000)}`;
  handleSend({ text });
}

function handleRetry(payload: { providerId: string }) {
  // 复用最后一条用户消息，只对单个 provider 重跑
  const lastUser = [...messages.value].reverse().find((m) => m.role === 'user');
  if (!lastUser || !lastUser.content) return;
  selectedProviderIds.value = [payload.providerId];
  handleSend({ text: lastUser.content });
}

function handleShortcut(payload: { type: 'roundtable' | 'relay' }) {
  if (payload.type === 'roundtable') {
    console.info('[ChatWorkspace] 圆桌交锋：M5 工作流尚未实现（已记录）');
  } else if (payload.type === 'relay') {
    console.info('[ChatWorkspace] 串联接力：M5 工作流尚未实现（已记录）');
  }
}

function selectAll() {
  if (selectedProviderIds.value.length === enabledProviders.value.length) {
    selectedProviderIds.value = [];
  } else {
    selectedProviderIds.value = enabledProviders.value.map((p) => p.id).slice(0, 4);
  }
}

onMounted(() => {
  // 默认全选前 4 个 provider
  selectedProviderIds.value = enabledProviders.value.map((p) => p.id).slice(0, 4);
  // 加载已有会话
  if (conversation.currentMessages.length > 0) {
    messages.value = conversation.currentMessages.map((m) => ({
      id: m.id,
      conversationId: m.conversationId,
      parentId: m.parentId || null,
      role: m.role,
      content: m.content,
      modelResponses: (m.modelResponses || []).map((r) => ({
        providerId: r.providerId,
        status: 'done' as const,
        content: r.content || '',
        metrics: r.metrics
          ? {
              providerId: r.providerId,
              model: '',
              startTime: 0,
              firstTokenTime: null,
              endTime: null,
              totalLatency: r.metrics.latencyMs ?? null,
              tokensPerSecond: null,
              estimatedCost: null,
            }
          : null,
      })),
      createdAt: m.createdAt,
    }));
  }
  // 监听全局 abort 总线
  unsubAbort = busOn('ABORT_ALL_REQUESTS', () => {
    handleAbort();
  });
});

onUnmounted(() => {
  unsubAbort?.();
  unsubAbort = null;
});

watch(
  () => enabledProviders.value.length,
  (next) => {
    // 当 provider 列表变化时，自动剔除已不存在的选中
    const validIds = new Set(enabledProviders.value.map((p) => p.id));
    selectedProviderIds.value = selectedProviderIds.value.filter((id) => validIds.has(id));
  },
);
</script>

<template>
  <div class="chat-workspace">
    <header class="chat-workspace__head">
      <div class="chat-workspace__title">
        <span class="chat-workspace__title-text">Chat Workspace</span>
        <span class="chat-workspace__sub muted">
          {{ enabledProviders.length }} 个 Provider 可用 · 当前选中 {{ selectedProviderIds.length }}
        </span>
      </div>
      <div class="chat-workspace__head-actions">
        <button
          v-if="enabledProviders.length > 0"
          type="button"
          class="chat-workspace__select-all"
          @click="selectAll"
        >
          {{ selectedProviderIds.length === Math.min(4, enabledProviders.length) ? '清空' : '全选' }}
        </button>
      </div>
    </header>
    <MessageList
      :messages="messages"
      :providers="enabledProviders"
      :active-provider-ids="selectedProviderIds"
      @continue="handleContinueFromCard"
      @abort="handleAbort"
      @retry="handleRetry"
    />
    <InputComposer
      :providers="enabledProviders"
      :selected-provider-ids="selectedProviderIds"
      :disabled="isStreaming"
      @update:selected-provider-ids="(v) => (selectedProviderIds = v)"
      @send="handleSend"
      @abort="handleAbort"
      @shortcut="handleShortcut"
    />
  </div>
</template>

<style scoped>
.chat-workspace {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  overflow: hidden;
  box-shadow: var(--shadow-sm);
}

.chat-workspace__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border);
  background: var(--card);
}

.chat-workspace__title {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.chat-workspace__title-text {
  font-size: var(--fs-sm);
  font-weight: 800;
  color: var(--text);
}

.chat-workspace__sub {
  font-size: var(--fs-10);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-weight: 600;
}

.chat-workspace__select-all {
  font-size: var(--fs-11);
  font-weight: 700;
  padding: 4px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--panel);
  color: var(--text);
  cursor: pointer;
}

.chat-workspace__select-all:hover {
  background: var(--primary-soft);
  color: var(--primary);
  border-color: #d2d6ff;
}
</style>
