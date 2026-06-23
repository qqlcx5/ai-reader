<script lang="ts" setup>
import { onMounted, onUnmounted } from 'vue';

interface Props {
  visible: boolean;
  title?: string;
  width?: string;
  closable?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  title: '',
  width: '480px',
  closable: true,
});

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'confirm'): void;
}>();

function onKeydown(ev: KeyboardEvent) {
  if (ev.key === 'Escape' && props.closable) {
    emit('close');
  }
}

onMounted(() => {
  document.addEventListener('keydown', onKeydown);
});

onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown);
});

function onOverlayClick(ev: MouseEvent) {
  if (props.closable && ev.target === ev.currentTarget) {
    emit('close');
  }
}
</script>

<template>
  <Transition name="modal-overlay">
    <div
      v-if="visible"
      class="modal-overlay"
      role="dialog"
      :aria-modal="true"
      :aria-label="title || 'Dialog'"
      @click="onOverlayClick"
    >
      <Transition name="modal-dialog">
        <div
          v-if="visible"
          class="modal-dialog"
          :style="{ maxWidth: width }"
          @click.stop
        >
          <!-- Title bar -->
          <header v-if="title || $slots.header" class="modal-dialog__head">
            <slot name="header">
              <span class="modal-dialog__title">{{ title }}</span>
            </slot>
            <button
              v-if="closable"
              class="modal-dialog__close"
              aria-label="关闭"
              @click="emit('close')"
            >
              ✕
            </button>
          </header>

          <!-- Content -->
          <div class="modal-dialog__body">
            <slot />
          </div>

          <!-- Footer actions -->
          <footer v-if="$slots.footer" class="modal-dialog__foot">
            <slot name="footer" />
          </footer>
          <footer v-else-if="$slots.actions === undefined" class="modal-dialog__foot">
            <button class="modal-dialog__btn modal-dialog__btn--cancel" @click="emit('close')">
              取消
            </button>
            <button class="modal-dialog__btn modal-dialog__btn--confirm" @click="emit('confirm')">
              确认
            </button>
          </footer>
        </div>
      </Transition>
    </div>
  </Transition>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}

.modal-dialog {
  width: 100%;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.2), 0 4px 16px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* Header */
.modal-dialog__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  background: var(--card);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.modal-dialog__title {
  font-size: var(--fs-sm);
  font-weight: 700;
  color: var(--text);
}

.modal-dialog__close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  font-size: 12px;
  color: var(--muted);
  background: transparent;
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
}

.modal-dialog__close:hover {
  background: var(--border);
  color: var(--text);
}

/* Body */
.modal-dialog__body {
  flex: 1;
  padding: 20px 18px;
  overflow-y: auto;
}

/* Footer */
.modal-dialog__foot {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 18px;
  background: var(--bg);
  border-top: 1px solid var(--border);
  flex-shrink: 0;
}

.modal-dialog__btn {
  padding: 8px 18px;
  font-size: var(--fs-xs);
  font-weight: 700;
  border-radius: var(--radius-lg);
  border: 1.5px solid transparent;
  cursor: pointer;
  transition: background 0.12s, border-color 0.12s;
}

.modal-dialog__btn--cancel {
  background: var(--panel);
  color: var(--text);
  border-color: var(--border);
}

.modal-dialog__btn--cancel:hover {
  background: var(--card);
  border-color: var(--border-strong);
}

.modal-dialog__btn--confirm {
  background: var(--primary);
  color: #fff;
  border-color: var(--primary);
  box-shadow: 0 2px 8px rgba(91, 96, 229, 0.25);
}

.modal-dialog__btn--confirm:hover {
  background: var(--primary-strong);
  border-color: var(--primary-strong);
}

/* Overlay transition */
.modal-overlay-enter-active {
  transition: opacity 0.15s ease-out;
}
.modal-overlay-leave-active {
  transition: opacity 0.1s ease-in;
}
.modal-overlay-enter-from,
.modal-overlay-leave-to {
  opacity: 0;
}

/* Dialog transition: scale + opacity */
.modal-dialog-enter-active {
  transition: opacity 0.15s ease-out, transform 0.15s cubic-bezier(0.16, 1, 0.3, 1);
}
.modal-dialog-leave-active {
  transition: opacity 0.1s ease-in, transform 0.1s ease-in;
}
.modal-dialog-enter-from,
.modal-dialog-leave-to {
  opacity: 0;
  transform: scale(0.95) translateY(-8px);
}
.modal-dialog-enter-to,
.modal-dialog-leave-from {
  opacity: 1;
  transform: scale(1) translateY(0);
}
</style>
