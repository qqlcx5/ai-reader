import { ref } from 'vue';
import { defineStore } from 'pinia';
import type { CurrentContext, ContextMode } from '@/modules/storage/types';

export const useContextStore = defineStore(
  'context',
  () => {
    const currentContext = ref<CurrentContext>({
      title: '',
      url: '',
      excerpt: '',
      fullText: '',
      readabilityHtml: '',
      rawText: '',
      mode: 'full',
    });

    function setContext(context: Partial<CurrentContext>) {
      currentContext.value = { ...currentContext.value, ...context };
    }

    function setMode(mode: ContextMode) {
      currentContext.value.mode = mode;
    }

    function reset() {
      currentContext.value = {
        title: '',
        url: '',
        excerpt: '',
        fullText: '',
        readabilityHtml: '',
        rawText: '',
        mode: 'full',
      };
    }

    return {
      currentContext,
      setContext,
      setMode,
      reset,
    };
  },
  {
    persist: {
      key: (id: string) => `pinia-${id}`,
      pick: ['currentContext'],
    },
  },
);
