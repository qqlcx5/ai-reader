<script lang="ts" setup>
import { ref } from 'vue'
import { rssRepo } from '@/lib/db/repositories/rss.repo'
import { fetchFeed } from '@/lib/rss/fetcher'
import type { RSSFeedRecord } from '@/lib/db/types'

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'added'): void
}>()

const url = ref('')
const validating = ref(false)
const adding = ref(false)
const previewTitle = ref('')
const previewCount = ref(0)
const errorMsg = ref('')
const step = ref<'input' | 'preview'>('input')

async function validateFeed() {
  errorMsg.value = ''
  previewTitle.value = ''
  previewCount.value = 0

  const trimmed = url.value.trim()
  if (!trimmed) {
    errorMsg.value = '请输入 RSS 订阅地址'
    return
  }

  validating.value = true
  try {
    const data = await fetchFeed(trimmed)
    if (data.items.length === 0 && !data.feedTitle) {
      errorMsg.value = '未能解析到有效的 RSS 内容，请检查地址'
      return
    }
    previewTitle.value = data.feedTitle || trimmed
    previewCount.value = Math.min(data.items.length, 3)
    step.value = 'preview'
  } catch (err) {
    errorMsg.value = err instanceof Error ? err.message : '验证失败，请检查地址或网络'
  } finally {
    validating.value = false
  }
}

async function addFeed() {
  adding.value = true
  try {
    const feedId = await sha256(url.value.trim())
    const feed: RSSFeedRecord = {
      id: feedId,
      url: url.value.trim(),
      title: previewTitle.value,
      fetchInterval: 30,
      lastFetched: 0,
      articles: [],
    }
    await rssRepo.saveFeed(feed)
    emit('added')
    emit('close')
  } catch (err) {
    errorMsg.value = err instanceof Error ? err.message : '添加失败'
  } finally {
    adding.value = false
  }
}

async function sha256(text: string): Promise<string> {
  const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function reset() {
  step.value = 'input'
  previewTitle.value = ''
  previewCount.value = 0
  errorMsg.value = ''
}
</script>

<template>
  <div class="modal-overlay" @click.self="emit('close')">
    <div class="modal">
      <div class="modal__header">
        <h3 class="modal__title">添加 RSS 订阅</h3>
        <button class="modal__close" @click="emit('close')" aria-label="关闭">✕</button>
      </div>

      <div class="modal__body">
        <!-- 输入步骤 -->
        <template v-if="step === 'input'">
          <div class="modal__field">
            <label class="modal__label">RSS 订阅地址</label>
            <input
              v-model="url"
              type="url"
              class="modal__input"
              placeholder="https://example.com/rss.xml"
              autocomplete="off"
              @keydown.enter="validateFeed"
            />
          </div>

          <p v-if="errorMsg" class="modal__error">{{ errorMsg }}</p>

          <div class="modal__actions">
            <button class="modal__btn modal__btn--ghost" @click="emit('close')">取消</button>
            <button
              class="modal__btn modal__btn--primary"
              :disabled="validating || !url.trim()"
              @click="validateFeed"
            >
              <span v-if="validating" class="modal__spinner">⟳</span>
              {{ validating ? '验证中…' : '验证' }}
            </button>
          </div>
        </template>

        <!-- 预览步骤 -->
        <template v-else>
          <div class="modal__preview">
            <div class="modal__preview-icon">📡</div>
            <div class="modal__preview-info">
              <p class="modal__preview-title">{{ previewTitle }}</p>
              <p class="modal__preview-meta">{{ url }}</p>
              <p class="modal__preview-count">已解析 {{ previewCount }} 篇文章</p>
            </div>
          </div>

          <p v-if="errorMsg" class="modal__error">{{ errorMsg }}</p>

          <div class="modal__actions">
            <button class="modal__btn modal__btn--ghost" @click="reset">重新输入</button>
            <button
              class="modal__btn modal__btn--primary"
              :disabled="adding"
              @click="addFeed"
            >
              <span v-if="adding" class="modal__spinner">⟳</span>
              {{ adding ? '添加中…' : '添加订阅' }}
            </button>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: var(--modal-overlay);
  z-index: 500;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.modal {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-lg);
  width: 100%;
  max-width: 360px;
  display: flex;
  flex-direction: column;
}

.modal__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px 12px;
  border-bottom: 1px solid var(--border);
}

.modal__title {
  font-size: var(--fs-sm);
  font-weight: 700;
  color: var(--text);
  margin: 0;
}

.modal__close {
  padding: 2px 6px;
  font-size: 14px;
  color: var(--muted);
  border-radius: var(--radius-sm);
  transition: background 0.1s, color 0.1s;
}

.modal__close:hover {
  background: var(--card);
  color: var(--text);
}

.modal__body {
  padding: 14px 16px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.modal__field {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.modal__label {
  font-size: 11px;
  font-weight: 700;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.modal__input {
  padding: 8px 10px;
  font-size: var(--fs-xs);
  color: var(--text);
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  outline: none;
  width: 100%;
  box-sizing: border-box;
  transition: border-color 0.12s, box-shadow 0.12s;
}

.modal__input:focus {
  border-color: rgba(91, 96, 229, 0.5);
  box-shadow: 0 0 0 3px rgba(91, 96, 229, 0.1);
}

.modal__error {
  font-size: 11px;
  color: var(--red);
  margin: 0;
  padding: 6px 10px;
  background: var(--red-soft);
  border-radius: var(--radius-sm);
}

.modal__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 4px;
}

.modal__btn {
  padding: 7px 16px;
  font-size: var(--fs-xs);
  font-weight: 700;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: background 0.12s, border-color 0.12s, color 0.12s;
  display: flex;
  align-items: center;
  gap: 5px;
}

.modal__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.modal__btn--ghost {
  color: var(--muted);
  background: transparent;
  border: 1px solid var(--border);
}

.modal__btn--ghost:hover:not(:disabled) {
  background: var(--card);
}

.modal__btn--primary {
  color: #fff;
  background: var(--primary);
  border: 1px solid transparent;
}

.modal__btn--primary:hover:not(:disabled) {
  background: var(--primary-strong);
}

.modal__spinner {
  display: inline-block;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.modal__preview {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  background: var(--primary-soft);
  border-radius: var(--radius-md);
  border: 1px solid #d2d6ff;
}

.modal__preview-icon {
  font-size: 24px;
  flex-shrink: 0;
  margin-top: 2px;
}

.modal__preview-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.modal__preview-title {
  font-size: var(--fs-sm);
  font-weight: 700;
  color: var(--text);
  margin: 0;
  word-break: break-word;
}

.modal__preview-meta {
  font-size: 11px;
  color: var(--muted);
  margin: 0;
  word-break: break-all;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.modal__preview-count {
  font-size: 11px;
  color: var(--primary);
  margin: 0;
  font-weight: 600;
}
</style>
