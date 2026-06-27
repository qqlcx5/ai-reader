<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from 'vue';
import {
  MessageCircle, Zap, StopCircle, Copy, Trash2,
  Brain, Sparkles, ListChecks, Tags, Bot, User,
  AlertCircle, ChevronDown,
} from '@lucide/vue';
import { useChat } from '../composables/useChat';
import { useLibraryStore } from '@/stores/library';
import { useToast } from '../composables/useToast';
import { usePopupStore } from '@/stores/popup';
import { listWorkflows, type WorkflowType } from '@/core/chat/workflow-prompts';
import { providerRegistry } from '@/core/models/provider-registry';
import type { ModelProvider } from '@/shared/domain';
import AppCard from '../components/AppCard.vue';
import StreamingMessage from '../components/StreamingMessage.vue';

const popup = usePopupStore();
const library = useLibraryStore();
const toast = useToast();
const {
  messages, status, streamContent, error,
  loadSession, startAnalysis, sendMessage, stopGeneration,
  clearContext, copySummary, retryLast,
} = useChat();

// Workflows
const workflows = listWorkflows();
const selectedWorkflow = ref<WorkflowType>('tldr');

// Providers & models
const providers = ref<ModelProvider[]>([]);
const selectedProviderId = ref('');
const selectedModel = ref('');
const showProviderDropdown = ref(false);
const showWorkflowDropdown = ref(false);
const providersLoaded = ref(false);

// Input
const inputText = ref('');
const isSending = computed(() => status.value === 'generating');

// Chat scroll
const chatContainer = ref<HTMLElement | null>(null);
const inputRef = ref<HTMLInputElement | null>(null);

onMounted(async () => {
  await providerRegistry.load();
  providers.value = providerRegistry.getAll();
  if (providers.value.length > 0) {
    selectedProviderId.value = providers.value[0].id;
    if (providers.value[0].models.length > 0) {
      selectedModel.value = providers.value[0].models[0];
    }
  }
  providersLoaded.value = true;

  // Load existing chat session for current article
  if (library.selectedId) {
    await loadSession(library.selectedId);
  }
});

// Watch library selection changes
watch(() => library.selectedId, async (newId) => {
  if (newId) {
    await loadSession(newId);
  }
});

watch(selectedProviderId, (newId) => {
  const provider = providers.value.find((p) => p.id === newId);
  if (provider && provider.models.length > 0) {
    selectedModel.value = provider.models[0];
  }
});

function selectProvider(id: string) {
  selectedProviderId.value = id;
  showProviderDropdown.value = false;
}

function selectWorkflow(type: WorkflowType) {
  selectedWorkflow.value = type;
  showWorkflowDropdown.value = false;
}

async function handleStartAnalysis() {
  const article = library.selectedArticle;
  if (!article) {
    toast.showError('请先选择一篇文章');
    return;
  }

  try {
    await startAnalysis(article.id, article.title, article.markdown, selectedWorkflow.value);
  } catch (err: any) {
    toast.showError('分析失败', err.message);
  }
}

async function handleSend() {
  const text = inputText.value.trim();
  if (!text || isSending.value) return;

  const article = library.selectedArticle;
  if (!article) {
    toast.showError('请先选择一篇文章');
    return;
  }

  inputText.value = '';
  try {
    await sendMessage(article.id, text);
  } catch (err: any) {
    toast.showError('发送失败', err.message);
  }
}

async function handleClear() {
  await clearContext();
}

function handleCopy() {
  copySummary();
  toast.showSuccess('已复制到剪贴板');
}

function handleStop() {
  stopGeneration();
}

function handleRetry() {
  retryLast();
}

function scrollToBottom() {
  nextTick(() => {
    if (chatContainer.value) {
      chatContainer.value.scrollTop = chatContainer.value.scrollHeight;
    }
  });
}

watch(messages, () => scrollToBottom(), { deep: false });
watch(streamContent, () => scrollToBottom());

function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

const currentProvider = computed(() =>
  providers.value.find((p) => p.id === selectedProviderId.value),
);

const workflowIcon = (type: WorkflowType) => {
  switch (type) {
    case 'tldr': return Sparkles;
    case 'knowledge-extractor': return Brain;
    case 'action-items': return ListChecks;
    case 'generate-tags': return Tags;
  }
};

const statusText = computed(() => {
  switch (status.value) {
    case 'idle': return '就绪';
    case 'generating': return 'AI 生成中...';
    case 'done': return '完成';
    case 'error': return '错误';
  }
});

const statusColor = computed(() => {
  switch (status.value) {
    case 'idle': return 'text-gray-400';
    case 'generating': return 'text-blue';
    case 'done': return 'text-green';
    case 'error': return 'text-red';
  }
});
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Selector bar -->
    <div class="px-3 pt-3 pb-2 space-y-2 flex-shrink-0">
      <!-- Provider + Model selector -->
      <div class="flex items-center gap-2">
        <div class="relative flex-1">
          <button
            class="w-full flex items-center justify-between px-3 py-1.5 rounded-xl bg-card border border-gray-200/60 text-xs text-left"
            @click="showProviderDropdown = !showProviderDropdown"
          >
            <span class="truncate">{{ currentProvider?.name ?? '选择模型' }}</span>
            <span class="text-10px text-gray-400 ml-1">{{ selectedModel }}</span>
            <ChevronDown class="w-3.5 h-3.5 ml-1 text-gray-400 flex-shrink-0" />
          </button>
          <div
            v-if="showProviderDropdown"
            class="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl border border-gray-200 shadow-lg z-50 max-h-40 overflow-y-auto"
          >
            <div v-for="p in providers" :key="p.id">
              <button
                class="w-full px-3 py-2 text-xs text-left hover:bg-gray-50 flex items-center justify-between"
                :class="{ 'text-blue font-medium': selectedProviderId === p.id }"
                @click="selectProvider(p.id)"
              >
                <span>{{ p.name }}</span>
                <span class="text-10px text-gray-400">{{ p.models[0] }}</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Workflow selector -->
        <div class="relative w-32">
          <button
            class="w-full flex items-center justify-between px-3 py-1.5 rounded-xl bg-card border border-gray-200/60 text-xs"
            @click="showWorkflowDropdown = !showWorkflowDropdown"
          >
            <span class="truncate">{{ workflows.find(w => w.type === selectedWorkflow)?.label ?? 'TL;DR' }}</span>
            <ChevronDown class="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
          </button>
          <div
            v-if="showWorkflowDropdown"
            class="absolute top-full right-0 mt-1 bg-white rounded-xl border border-gray-200 shadow-lg z-50 min-w-40"
          >
            <button
              v-for="wf in workflows"
              :key="wf.type"
              class="w-full px-3 py-2 text-xs text-left hover:bg-gray-50 flex items-center gap-1.5"
              :class="{ 'text-blue font-medium': selectedWorkflow === wf.type }"
              @click="selectWorkflow(wf.type)"
            >
              <component :is="workflowIcon(wf.type)" class="w-3.5 h-3.5" />
              <span>{{ wf.label }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Action button: Start Analysis -->
    <div class="px-3 mb-2 flex-shrink-0" v-if="!messages.length || status === 'done'">
      <button
        class="w-full py-2.5 rounded-16px text-white text-sm font-medium border-0 cursor-pointer transition-all duration-200"
        style="background: linear-gradient(135deg, #3B82F6, #8B5CF6);"
        :disabled="isSending"
        @click="handleStartAnalysis"
      >
        <Sparkles class="w-4 h-4 inline-block mr-1" />
        一键运行 AI 分析
      </button>
    </div>

    <!-- Stop / Copy / Clear bar (during/after generation) -->
    <div v-if="messages.length" class="px-3 mb-2 flex items-center gap-2 flex-shrink-0">
      <button
        v-if="isSending"
        class="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-red-50 text-red text-xs font-medium border border-red-200 hover:bg-red-100 transition-colors"
        @click="handleStop"
      >
        <StopCircle class="w-3.5 h-3.5" />
        停止生成
      </button>
      <button
        v-if="!isSending"
        class="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-gray-50 text-gray-600 text-xs font-medium border border-gray-200 hover:bg-gray-100 transition-colors"
        @click="handleCopy"
      >
        <Copy class="w-3.5 h-3.5" />
        复制总结
      </button>
      <button
        class="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-gray-50 text-gray-600 text-xs font-medium border border-gray-200 hover:bg-gray-100 transition-colors"
        @click="handleClear"
      >
        <Trash2 class="w-3.5 h-3.5" />
        清除上下文
      </button>
      <button
        v-if="status === 'error'"
        class="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-50 text-amber-700 text-xs font-medium border border-amber-200 hover:bg-amber-100 transition-colors"
        @click="handleRetry"
      >
        重试
      </button>
    </div>

    <!-- AI Status indicator -->
    <div class="px-3 flex-shrink-0">
      <div class="flex items-center gap-1.5 text-10px" :class="statusColor">
        <span class="w-1.5 h-1.5 rounded-full inline-block" :class="{
          'bg-gray-400': status === 'idle',
          'bg-blue animate-pulse': status === 'generating',
          'bg-green': status === 'done',
          'bg-red': status === 'error',
        }" />
        {{ statusText }}
      </div>
    </div>

    <!-- Main content area -->
    <div
      ref="chatContainer"
      class="flex-1 overflow-y-auto px-3 py-3 space-y-3"
    >
      <!-- Empty state -->
      <div v-if="!messages.length && !isSending" class="flex flex-col items-center justify-center py-12 text-center">
        <MessageCircle class="w-12 h-12 text-gray-200 mb-3" />
        <p class="text-sm text-gray-400 font-medium mb-1">AI 文章消化</p>
        <p class="text-11px text-gray-300 max-w-56">
          选择工作流并点击「一键运行 AI 分析」，或直接输入问题与文章对话
        </p>
      </div>

      <!-- Error state -->
      <div v-if="status === 'error' && error" class="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200">
        <AlertCircle class="w-4 h-4 text-red flex-shrink-0 mt-0.5" />
        <p class="text-xs text-red-700">{{ error }}</p>
      </div>

      <!-- API Key not configured prompt -->
      <div v-if="status === 'error' && error?.includes('API Key')" class="text-center py-4">
        <p class="text-xs text-gray-500 mb-2">请先在设置中配置 LLM API Key</p>
        <button
          class="px-4 py-1.5 rounded-xl bg-blue text-white text-xs font-medium"
          @click="popup.setView('settings')"
        >
          前往设置
        </button>
      </div>

      <!-- Chat messages -->
      <div
        v-for="msg in messages"
        :key="msg.id ?? msg.createdAt"
        :class="[
          'flex gap-2',
          msg.role === 'user' ? 'justify-end' : 'justify-start',
        ]"
      >
        <!-- AI avatar (left) -->
        <div v-if="msg.role === 'assistant'" class="w-6 h-6 rounded-full bg-purple/10 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Bot class="w-3.5 h-3.5 text-purple" />
        </div>

        <!-- Message bubble -->
        <div
          :class="[
            'max-w-85% px-3 py-2 rounded-2xl text-xs leading-relaxed',
            msg.role === 'user'
              ? 'bg-blue text-white rounded-br-md'
              : 'bg-gray-100 text-text rounded-bl-md',
          ]"
        >
          <div v-if="msg.role === 'user'" class="whitespace-pre-wrap break-words">{{ msg.content }}</div>
          <div v-else class="max-w-full">
            <StreamingMessage
              :content="msg.content"
              :is-streaming="false"
            />
          </div>
          <div class="text-9px mt-1 opacity-50" :class="msg.role === 'user' ? 'text-right' : 'text-left'">
            {{ formatTime(msg.createdAt) }}
          </div>
        </div>

        <!-- User avatar (right) -->
        <div v-if="msg.role === 'user'" class="w-6 h-6 rounded-full bg-blue/10 flex items-center justify-center flex-shrink-0 mt-0.5">
          <User class="w-3.5 h-3.5 text-blue" />
        </div>
      </div>

      <!-- Streaming message -->
      <div v-if="isSending && streamContent" class="flex gap-2">
        <div class="w-6 h-6 rounded-full bg-purple/10 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Bot class="w-3.5 h-3.5 text-purple" />
        </div>
        <div class="max-w-85% px-3 py-2 rounded-2xl bg-gray-100 text-text rounded-bl-md text-xs">
          <StreamingMessage :content="streamContent" :is-streaming="true" />
        </div>
      </div>

      <!-- Streaming placeholder (waiting for first token) -->
      <div v-if="isSending && !streamContent" class="flex gap-2">
        <div class="w-6 h-6 rounded-full bg-purple/10 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Bot class="w-3.5 h-3.5 text-purple animate-pulse" />
        </div>
        <div class="px-3 py-2 rounded-2xl bg-gray-100 rounded-bl-md">
          <span class="text-xs text-gray-400 cursor-blink">AI 正在思考...</span>
        </div>
      </div>
    </div>

    <!-- Input area -->
    <div class="px-3 py-2.5 border-t border-gray-200/60 flex-shrink-0">
      <div class="flex items-center gap-2">
        <input
          ref="inputRef"
          v-model="inputText"
          type="text"
          aria-label="追问输入"
          placeholder="输入追问..."
          class="flex-1 px-3 py-2 rounded-xl bg-gray-50 border border-gray-200/60 text-xs outline-none focus:border-blue/40 focus:bg-white transition-colors"
          :disabled="isSending"
          @keydown.enter="handleSend"
        />
        <button
          class="px-4 py-2 rounded-xl bg-blue text-white text-xs font-medium border-0 cursor-pointer hover:bg-blue/90 transition-colors disabled:opacity-50"
          aria-label="发送消息"
          :disabled="!inputText.trim() || isSending"
          @click="handleSend"
        >
          发送
        </button>
      </div>
    </div>
  </div>
</template>
