<script lang="ts" setup>
export interface NavItem {
  id: string;
  label: string;
  icon: string;
  badge?: number;
}

const DEFAULT_ITEMS: NavItem[] = [
  { id: 'chat',      label: '对话',   icon: '💬' },
  { id: 'history',   label: '历史',   icon: '🕐' },
  { id: 'rss',       label: 'RSS',    icon: '📡' },
  { id: 'workflows', label: '工作流', icon: '⚡' },
  { id: 'export',    label: '导出',   icon: '📤' },
  { id: 'settings',  label: '设置',   icon: '⚙' },
];

const props = withDefaults(
  defineProps<{
    items?: NavItem[];
    activeId?: string;
    rssBadgeCount?: number;
  }>(),
  {
    items: () => DEFAULT_ITEMS,
    activeId: 'chat',
    rssBadgeCount: 0,
  },
);

const emit = defineEmits<{
  (e: 'navigate', id: string): void;
}>();
</script>

<template>
  <nav class="main-nav" aria-label="主导航">
    <ul class="main-nav__list" role="list">
      <li
        v-for="item in items"
        :key="item.id"
        class="main-nav__item"
      >
        <button
          class="main-nav__btn"
          :class="{ 'main-nav__btn--active': item.id === activeId }"
          :aria-current="item.id === activeId ? 'page' : undefined"
          @click="emit('navigate', item.id)"
        >
          <span class="main-nav__icon" aria-hidden="true">{{ item.icon }}</span>
          <span class="main-nav__label">{{ item.label }}</span>

          <!-- RSS unread badge -->
          <span
            v-if="item.id === 'rss' && rssBadgeCount > 0"
            class="main-nav__badge"
            :aria-label="`${rssBadgeCount} 条未读`"
          >
            {{ rssBadgeCount > 99 ? '99+' : rssBadgeCount }}
          </span>
        </button>
      </li>
    </ul>
  </nav>
</template>

<style scoped>
.main-nav {
  flex: 1;
  padding: 10px 10px;
  overflow-y: auto;
}

.main-nav__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.main-nav__btn {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  padding: 8px 10px;
  font-size: var(--fs-xs);
  font-weight: 600;
  color: var(--text);
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-lg);
  cursor: pointer;
  text-align: left;
  transition: background 0.12s, color 0.12s, border-color 0.12s;
  position: relative;
}

.main-nav__btn:hover {
  background: var(--bg);
}

.main-nav__btn--active {
  background: var(--primary-soft) !important;
  color: var(--primary);
  border-color: #d2d6ff;
  font-weight: 800;
}

.main-nav__icon {
  flex-shrink: 0;
  font-size: 14px;
  width: 18px;
  text-align: center;
  line-height: 1;
}

.main-nav__label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1;
}

.main-nav__badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  font-size: 9px;
  font-weight: 700;
  color: #fff;
  background: var(--primary);
  border-radius: var(--radius-pill);
  flex-shrink: 0;
}
</style>
