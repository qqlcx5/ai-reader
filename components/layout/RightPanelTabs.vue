<script lang="ts" setup>
import { ref } from 'vue';
import EmptyState from '@/components/shared/EmptyState.vue';
import RSSPanel from '@/components/rss/RSSPanel.vue';
import HistoryList from '@/components/library/HistoryList.vue';
import SnapshotViewer from '@/components/library/SnapshotViewer.vue';
import type { ConversationRecord } from '@/lib/db/types';
import { conversationRepo } from '@/lib/db/repositories/conversation.repo';
import { search as workerSearch } from '@/lib/library/search';
import type { SearchResult } from '@/lib/library/search';

// ── History panel state ───────────────────────────────────────────────────────
const historySelectedConv = ref<ConversationRecord | null>(null);
const historySearchResults = ref<SearchResult[]>([]);
const historyIsSearchMode = ref(false);
const historySearchLoading = ref(false);
const historyListRef = ref<InstanceType<typeof HistoryList> | null>(null);

async function onHistorySearch(q: string) {
  if (!q.trim()) {
    historyIsSearchMode.value = false;
    historySearchResults.value = [];
    return;
  }
  historyIsSearchMode.value = true;
  historySearchLoading.value = true;
  try {
    historySearchResults.value = await workerSearch(q, 50);
  } finally {
    historySearchLoading.value = false;
  }
}

async function onHistorySelectResult(result: SearchResult) {
  const conv = await conversationRepo.findById(result.pageId);
  if (conv) historySelectedConv.value = conv;
}

function onHistorySelect(item: ConversationRecord) {
  historySelectedConv.value = item;
}

function onHistoryContinue(pageId: string) {
  window.dispatchEvent(new CustomEvent('library:continue-conversation', { detail: { pageId } }));
}

// ─────────────────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'history',   label: '历史' },
  { id: 'rss',       label: 'RSS' },
  { id: 'workflow',  label: '工作流' },
  { id: 'export',    label: '导出' },
  { id: 'settings',  label: '设置' },
  { id: 'arch',      label: '架构' },
] as const;

type TabId = typeof TABS[number]['id'];

const activeTab = ref<TabId>('history');

/* ── Architecture static markdown ────────────────────────────────── */
const archContent = `
## 工程架构说明

### 技术栈
- **框架**：Vue 3 + TypeScript + WXT
- **存储**：Dexie.js (IndexedDB) + 三级缓存
- **提取**：Mozilla Readability → Defuddle → Fallback
- **AI 提供商**：OpenAI / Anthropic / Gemini / Cohere / 兼容端点

### 目录结构
\`\`\`
entrypoints/   — Popup / SidePanel / Options / Background
components/    — UI 组件（layout / workspace / shared）
lib/           — 核心引擎（db / extraction / providers）
stores/        — Pinia 状态管理
styles/        — 全局 CSS 变量与工具类
\`\`\`

### 关键设计决策
- 页面隔离对话：每个 URL 拥有独立的对话历史
- 静默锚定：切换 Tab 时保持原上下文不变
- 无截断原则：全文传入 LLM，不做 Token 截断
- 零后端依赖：API Key 仅存于本地，直连厂商端点
`.trim();

function renderArch(md: string): string {
  return md
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>[\s\S]*?<\/li>)/g, '<ul>$1</ul>')
    .replace(/<\/ul>\s*<ul>/g, '')
    .replace(/\n{2,}/g, '</p><p>')
    .replace(/^(.)/gm, (m) => (m === '<' ? m : '<p>' + m))
    .replace(/\n/g, '');
}
</script>

<template>
  <div class="rpt">
    <!-- Tab bar: 6 equal tabs -->
    <div class="rpt__tabs" role="tablist" aria-label="右侧面板标签">
      <button
        v-for="tab in TABS"
        :key="tab.id"
        class="rpt__tab"
        :class="{ 'rpt__tab--active': activeTab === tab.id }"
        role="tab"
        :aria-selected="activeTab === tab.id"
        :aria-controls="`rpt-panel-${tab.id}`"
        @click="activeTab = tab.id"
      >
        {{ tab.label }}
      </button>
    </div>

    <!-- Tab panels -->
    <div class="rpt__body" role="tabpanel" :id="`rpt-panel-${activeTab}`" :aria-label="TABS.find(t => t.id === activeTab)?.label">
      <!-- History (M6 HistoryList + compact SnapshotViewer) -->
      <template v-if="activeTab === 'history'">
        <div class="rpt__history-panel">
          <!-- Compact list (紧凑模式, 无搜索框占位) -->
          <HistoryList
            ref="historyListRef"
            class="rpt__history-list"
            :compact="true"
            @select="onHistorySelect"
            @query="onHistorySearch"
          />
          <!-- Inline snapshot viewer (展开在下方) -->
          <SnapshotViewer
            v-if="historySelectedConv"
            class="rpt__history-viewer"
            :conversation="historySelectedConv"
            @close="historySelectedConv = null"
            @continue="onHistoryContinue"
          />
        </div>
      </template>

      <!-- RSS -->
      <template v-else-if="activeTab === 'rss'">
        <RSSPanel style="height: 100%; overflow: hidden;" />
      </template>

      <!-- Workflow -->
      <template v-else-if="activeTab === 'workflow'">
        <div class="rpt__card">
          <div class="rpt__card-title">工作流模板</div>
          <EmptyState
            icon="⚡"
            title="暂无工作流"
            description="创建自定义工作流以自动化对话流程"
            size="sm"
          />
        </div>
      </template>

      <!-- Export -->
      <template v-else-if="activeTab === 'export'">
        <div class="rpt__card">
          <div class="rpt__card-title">导出与同步</div>
          <div class="rpt__setting-row">
            <span class="rpt__setting-label">WebDAV 备份</span>
            <span class="rpt__setting-status rpt__setting-status--warn">未配置</span>
          </div>
          <div class="rpt__setting-row">
            <span class="rpt__setting-label">S3 存储</span>
            <span class="rpt__setting-status rpt__setting-status--warn">未配置</span>
          </div>
          <div class="rpt__setting-row">
            <span class="rpt__setting-label">本地导出</span>
            <button class="rpt__setting-btn">JSON / MD</button>
          </div>
        </div>
      </template>

      <!-- Settings -->
      <template v-else-if="activeTab === 'settings'">
        <div class="rpt__card">
          <div class="rpt__card-title">Provider 密钥</div>
          <div class="rpt__field">
            <label class="rpt__field-label">OpenAI API Key</label>
            <input type="password" class="rpt__field-input" placeholder="sk-••••••••" autocomplete="off" />
          </div>
          <div class="rpt__field">
            <label class="rpt__field-label">Anthropic API Key</label>
            <input type="password" class="rpt__field-input" placeholder="sk-ant-••••••••" autocomplete="off" />
          </div>
          <div class="rpt__field">
            <label class="rpt__field-label">Gemini API Key</label>
            <input type="password" class="rpt__field-input" placeholder="AIza••••••••" autocomplete="off" />
          </div>
          <button class="rpt__save-btn">保存密钥</button>
        </div>
        <div class="rpt__card">
          <div class="rpt__card-title">同步配置</div>
          <div class="rpt__field">
            <label class="rpt__field-label">WebDAV 地址</label>
            <input type="url" class="rpt__field-input" placeholder="https://your-server/dav/" />
          </div>
        </div>
      </template>

      <!-- Architecture -->
      <template v-else-if="activeTab === 'arch'">
        <div class="rpt__card rpt__card--arch">
          <div class="rpt__card-title">工程实现说明</div>
          <div class="rpt__arch-content markdown-content" v-html="renderArch(archContent)"></div>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.rpt {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

/* History panel */
.rpt__history-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.rpt__history-list {
  flex-shrink: 0;
  height: 150px;
  border-bottom: 1px solid var(--border);
}

.rpt__history-viewer {
  flex: 1;
  overflow: hidden;
}

/* Tab bar */
.rpt__tabs {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  border-bottom: 1px solid var(--border);
  background: var(--panel);
  flex-shrink: 0;
}

.rpt__tab {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 10px 4px;
  font-size: 11px;
  font-weight: 800;
  color: var(--muted);
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  transition: color 0.12s, border-color 0.12s, background 0.12s;
  white-space: nowrap;
}

.rpt__tab:hover {
  color: var(--text);
  background: var(--card);
}

.rpt__tab--active {
  color: var(--primary);
  border-bottom-color: var(--primary);
  background: var(--panel);
}

/* Panel body */
.rpt__body {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* Cards */
.rpt__card {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.rpt__card--arch {
  background: var(--bg);
}

.rpt__card-title {
  font-size: var(--fs-xs);
  font-weight: 700;
  color: var(--text);
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border);
}

/* Setting row */
.rpt__setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: var(--fs-xs);
}

.rpt__setting-label {
  color: var(--text);
  font-weight: 600;
}

.rpt__setting-status {
  font-size: 10px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: var(--radius-pill);
}

.rpt__setting-status--warn {
  color: var(--orange);
  background: var(--orange-soft);
}

.rpt__setting-status--ok {
  color: var(--green);
  background: var(--green-soft);
}

.rpt__setting-btn {
  font-size: 11px;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
  background: var(--card);
  color: var(--text);
  cursor: pointer;
  transition: background 0.1s;
}

.rpt__setting-btn:hover {
  background: var(--primary-soft);
  border-color: #d2d6ff;
  color: var(--primary);
}

/* Fields */
.rpt__field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.rpt__field-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--muted);
}

.rpt__field-input {
  padding: 6px 9px;
  font-size: var(--fs-xs);
  color: var(--text);
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  outline: none;
  transition: border-color 0.12s, box-shadow 0.12s;
  width: 100%;
  box-sizing: border-box;
}

.rpt__field-input:focus {
  border-color: rgba(91, 96, 229, 0.5);
  box-shadow: 0 0 0 3px rgba(91, 96, 229, 0.1);
}

.rpt__save-btn {
  align-self: flex-end;
  padding: 7px 16px;
  font-size: 11px;
  font-weight: 700;
  color: #fff;
  background: var(--primary);
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: background 0.12s;
}

.rpt__save-btn:hover {
  background: var(--primary-strong);
}

/* Architecture content */
.rpt__arch-content {
  font-size: 11px;
  line-height: 1.65;
  color: var(--text);
}

.rpt__arch-content :deep(h2) {
  font-size: var(--fs-xs);
  font-weight: 700;
  margin: 10px 0 5px;
  color: var(--text);
}

.rpt__arch-content :deep(h3) {
  font-size: 11px;
  font-weight: 700;
  margin: 8px 0 4px;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.rpt__arch-content :deep(code) {
  font-size: 10px;
  font-family: var(--font-mono);
  background: var(--bg);
  color: var(--primary);
  padding: 1px 4px;
  border-radius: 4px;
}

.rpt__arch-content :deep(pre) {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 8px 10px;
  font-size: 10px;
  font-family: var(--font-mono);
  overflow-x: auto;
  line-height: 1.5;
}

.rpt__arch-content :deep(pre code) {
  background: none;
  color: var(--muted);
  padding: 0;
}

.rpt__arch-content :deep(ul) {
  padding-left: 16px;
  margin: 4px 0;
  list-style: disc;
}

.rpt__arch-content :deep(li) {
  margin-bottom: 2px;
}

.rpt__arch-content :deep(strong) {
  font-weight: 700;
  color: var(--text);
}
</style>
