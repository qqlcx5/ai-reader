<script lang="ts" setup>
/**
 * M5 — TemplateList
 *
 * Lists all prompt templates (from M8 templates table).
 * - Single click: emit 'insert' with resolved template text.
 * - Right-click / long-press: context menu with edit / delete / export.
 * - Shows icon + name + URL rule preview.
 */
import { ref, onMounted } from 'vue';
import { listTemplates, deleteTemplate, exportTemplates, downloadTemplatesJson, seedDefaultTemplates } from '@/lib/workflow/template-manager';
import type { TemplateRecord } from '@/lib/db/types';

const emit = defineEmits<{
  (e: 'insert', text: string): void;
}>();

const templates = ref<TemplateRecord[]>([]);
const loading   = ref(true);
const errorMsg  = ref('');
const contextMenu = ref<{ x: number; y: number; template: TemplateRecord } | null>(null);
const editingTemplate = ref<TemplateRecord | null>(null);
const longPressTimer = ref<ReturnType<typeof setTimeout> | null>(null);

async function load() {
  loading.value = true;
  try {
    await seedDefaultTemplates();
    templates.value = await listTemplates();
  } catch (err) {
    errorMsg.value = err instanceof Error ? err.message : '加载模板失败';
  } finally {
    loading.value = false;
  }
}

onMounted(load);

function handleClick(tpl: TemplateRecord) {
  if (contextMenu.value) {
    closeMenu();
    return;
  }
  emit('insert', tpl.prompt);
}

function handleContextMenu(e: MouseEvent, tpl: TemplateRecord) {
  e.preventDefault();
  contextMenu.value = { x: e.clientX, y: e.clientY, template: tpl };
}

function handlePointerDown(tpl: TemplateRecord) {
  longPressTimer.value = setTimeout(() => {
    // Show a simple context menu (will be triggered by long press)
    contextMenu.value = { x: 0, y: 0, template: tpl };
  }, 600);
}

function handlePointerUp() {
  if (longPressTimer.value) {
    clearTimeout(longPressTimer.value);
    longPressTimer.value = null;
  }
}

function closeMenu() {
  contextMenu.value = null;
}

function startEdit(tpl: TemplateRecord) {
  editingTemplate.value = { ...tpl };
  closeMenu();
}

async function saveEdit() {
  if (!editingTemplate.value) return;
  try {
    const { updateTemplate } = await import('@/lib/workflow/template-manager');
    const { id, createdAt, ...rest } = editingTemplate.value;
    await updateTemplate(id, rest);
    await load();
    editingTemplate.value = null;
  } catch (err) {
    errorMsg.value = err instanceof Error ? err.message : '保存失败';
  }
}

async function handleDelete(tpl: TemplateRecord) {
  closeMenu();
  if (!confirm(`确认删除模板「${tpl.name}」？`)) return;
  try {
    await deleteTemplate(tpl.id);
    await load();
  } catch (err) {
    errorMsg.value = err instanceof Error ? err.message : '删除失败';
  }
}

async function handleExport(tpl: TemplateRecord) {
  closeMenu();
  const json = await exportTemplates([tpl.id]);
  downloadTemplatesJson(json, `template-${tpl.name}.json`);
}

async function handleImport() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;
    const text = await file.text();
    try {
      const { importTemplates } = await import('@/lib/workflow/template-manager');
      const count = await importTemplates(text);
      await load();
      if (count === 0) {
        errorMsg.value = '未找到新模板（已存在的模板会被跳过）';
      }
    } catch (err) {
      errorMsg.value = err instanceof Error ? err.message : '导入失败';
    }
  };
  input.click();
}

async function handleExportAll() {
  const json = await exportTemplates();
  downloadTemplatesJson(json);
}
</script>

<template>
  <div class="tpl-list" @click.self="closeMenu" @keydown.escape="closeMenu">
    <!-- Toolbar -->
    <div class="tpl-list__toolbar">
      <span class="tpl-list__title">提示词模板</span>
      <div class="tpl-list__actions">
        <button type="button" class="tpl-list__icon-btn" title="导入 JSON" @click="handleImport">
          ↑ 导入
        </button>
        <button type="button" class="tpl-list__icon-btn" title="导出全部" @click="handleExportAll">
          ↓ 导出
        </button>
      </div>
    </div>

    <p v-if="errorMsg" class="tpl-list__error">{{ errorMsg }}</p>

    <!-- Loading state -->
    <p v-if="loading" class="tpl-list__hint">加载中…</p>

    <!-- Template items -->
    <ul v-else-if="templates.length" class="tpl-list__items">
      <li
        v-for="tpl in templates"
        :key="tpl.id"
        class="tpl-list__item"
        role="button"
        tabindex="0"
        @click="handleClick(tpl)"
        @keydown.enter="handleClick(tpl)"
        @contextmenu="handleContextMenu($event, tpl)"
        @pointerdown="handlePointerDown(tpl)"
        @pointerup="handlePointerUp"
        @pointerleave="handlePointerUp"
      >
        <span class="tpl-list__icon">{{ tpl.icon }}</span>
        <div class="tpl-list__info">
          <span class="tpl-list__name">{{ tpl.name }}</span>
          <span v-if="tpl.urlPattern" class="tpl-list__url-rule" :title="tpl.urlPattern">
            🔗 {{ tpl.urlPattern.slice(0, 30) }}{{ tpl.urlPattern.length > 30 ? '…' : '' }}
          </span>
          <span v-if="tpl.schemaType" class="tpl-list__schema-rule">
            📄 {{ tpl.schemaType }}
          </span>
        </div>
        <button
          type="button"
          class="tpl-list__menu-btn"
          aria-label="更多操作"
          @click.stop="handleContextMenu($event, tpl)"
        >
          ⋯
        </button>
      </li>
    </ul>

    <p v-else class="tpl-list__hint">暂无模板</p>

    <!-- Context menu -->
    <div
      v-if="contextMenu"
      class="tpl-list__context-menu"
      :style="contextMenu.x > 0 ? { position: 'fixed', left: `${contextMenu.x}px`, top: `${contextMenu.y}px` } : {}"
      @click.stop
    >
      <button type="button" @click="startEdit(contextMenu.template)">✏️ 编辑</button>
      <button type="button" @click="handleExport(contextMenu.template)">⬇️ 导出</button>
      <button type="button" class="danger" @click="handleDelete(contextMenu.template)">🗑️ 删除</button>
      <button type="button" @click="closeMenu">取消</button>
    </div>
    <!-- Context menu backdrop -->
    <div v-if="contextMenu" class="tpl-list__backdrop" @click="closeMenu" />

    <!-- Edit modal -->
    <div v-if="editingTemplate" class="tpl-list__modal-overlay" @click.self="editingTemplate = null">
      <div class="tpl-list__modal">
        <h4 class="tpl-list__modal-title">编辑模板</h4>

        <label class="tpl-list__modal-field">
          <span>图标</span>
          <input v-model="editingTemplate.icon" class="tpl-list__modal-input" placeholder="📝" />
        </label>

        <label class="tpl-list__modal-field">
          <span>名称</span>
          <input v-model="editingTemplate.name" class="tpl-list__modal-input" placeholder="模板名称" />
        </label>

        <label class="tpl-list__modal-field">
          <span>Prompt（支持 {{ '{{content}}' }} / {{ '{{title}}' }} 等变量）</span>
          <textarea
            v-model="editingTemplate.prompt"
            class="tpl-list__modal-textarea"
            rows="5"
          />
        </label>

        <label class="tpl-list__modal-field">
          <span>URL 正则规则（可选）</span>
          <input
            v-model="editingTemplate.urlPattern"
            class="tpl-list__modal-input"
            placeholder="github\\.com"
          />
        </label>

        <label class="tpl-list__modal-field">
          <span>Schema.org 类型（可选）</span>
          <input
            v-model="editingTemplate.schemaType"
            class="tpl-list__modal-input"
            placeholder="Article"
          />
        </label>

        <div class="tpl-list__modal-actions">
          <button type="button" class="tpl-list__btn tpl-list__btn--primary" @click="saveEdit">保存</button>
          <button type="button" class="tpl-list__btn" @click="editingTemplate = null">取消</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tpl-list {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.tpl-list__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.tpl-list__title {
  font-size: var(--fs-11);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--muted-light);
}

.tpl-list__actions {
  display: flex;
  gap: var(--space-1);
}

.tpl-list__icon-btn {
  font-size: var(--fs-11);
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--muted);
  padding: 2px 6px;
  cursor: pointer;
}

.tpl-list__icon-btn:hover {
  color: var(--text);
  border-color: var(--muted);
}

.tpl-list__error {
  font-size: var(--fs-11);
  color: var(--red);
  background: var(--red-soft);
  border-radius: var(--radius-sm);
  padding: var(--space-2) var(--space-3);
  margin: 0;
}

.tpl-list__hint {
  font-size: var(--fs-11);
  color: var(--muted-light);
  font-style: italic;
  margin: 0;
  text-align: center;
  padding: var(--space-4) 0;
}

.tpl-list__items {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.tpl-list__item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--card);
  cursor: pointer;
  transition: border-color 0.12s, background 0.12s;
  user-select: none;
}

.tpl-list__item:hover {
  border-color: var(--primary);
  background: var(--primary-soft);
}

.tpl-list__item:focus {
  outline: none;
  box-shadow: 0 0 0 2px var(--primary-soft);
}

.tpl-list__icon {
  font-size: 16px;
  flex-shrink: 0;
}

.tpl-list__info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.tpl-list__name {
  font-size: var(--fs-xs);
  font-weight: 600;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tpl-list__url-rule,
.tpl-list__schema-rule {
  font-size: var(--fs-11);
  color: var(--muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tpl-list__menu-btn {
  background: none;
  border: none;
  color: var(--muted-light);
  cursor: pointer;
  font-size: 18px;
  line-height: 1;
  padding: 0 2px;
  border-radius: var(--radius-sm);
  flex-shrink: 0;
  opacity: 0;
  transition: opacity 0.1s;
}

.tpl-list__item:hover .tpl-list__menu-btn {
  opacity: 1;
}

/* Context menu */
.tpl-list__context-menu {
  position: fixed;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  z-index: 1000;
  min-width: 140px;
  padding: var(--space-1) 0;
  display: flex;
  flex-direction: column;
}

.tpl-list__context-menu button {
  background: none;
  border: none;
  text-align: left;
  padding: 7px var(--space-3);
  font-size: var(--fs-xs);
  color: var(--text);
  cursor: pointer;
  transition: background 0.1s;
}

.tpl-list__context-menu button:hover {
  background: var(--card);
}

.tpl-list__context-menu button.danger {
  color: var(--red);
}

.tpl-list__backdrop {
  position: fixed;
  inset: 0;
  z-index: 999;
}

/* Edit modal */
.tpl-list__modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1100;
  backdrop-filter: blur(2px);
}

.tpl-list__modal {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg, 12px);
  padding: var(--space-4);
  width: 480px;
  max-width: 95vw;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.tpl-list__modal-title {
  margin: 0;
  font-size: var(--fs-sm);
  color: var(--text);
}

.tpl-list__modal-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: var(--fs-11);
  color: var(--muted);
  font-weight: 600;
}

.tpl-list__modal-input,
.tpl-list__modal-textarea {
  font-size: var(--fs-xs);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--card);
  color: var(--text);
  padding: 6px 8px;
  font-family: inherit;
  resize: vertical;
}

.tpl-list__modal-input:focus,
.tpl-list__modal-textarea:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px var(--primary-soft);
}

.tpl-list__modal-actions {
  display: flex;
  gap: var(--space-2);
  justify-content: flex-end;
}

.tpl-list__btn {
  padding: 7px 16px;
  font-size: var(--fs-xs);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--panel);
  color: var(--text);
  cursor: pointer;
}

.tpl-list__btn--primary {
  background: var(--primary);
  color: #fff;
  border-color: var(--primary);
}

.tpl-list__btn--primary:hover {
  background: #4a4fd4;
}
</style>
