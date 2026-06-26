import { defineStore } from 'pinia';
import { ref } from 'vue';

export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';

export const useSyncStore = defineStore('sync', () => {
  const status = ref<SyncStatus>('idle');
  const error = ref<string | null>(null);
  const lastSyncAt = ref<number | null>(null);

  function setStatus(s: SyncStatus) {
    status.value = s;
  }

  function setError(e: string | null) {
    error.value = e;
    if (e) status.value = 'error';
  }

  function setLastSyncAt(time: number) {
    lastSyncAt.value = time;
  }

  return {
    status,
    error,
    lastSyncAt,
    setStatus,
    setError,
    setLastSyncAt,
  };
});
