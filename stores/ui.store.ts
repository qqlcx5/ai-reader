import { ref } from 'vue';
import { defineStore } from 'pinia';
import { STORE_KEYS, type SearchResult } from '@/modules/storage/types';
import { chromeStorageLocal } from './chrome-storage';

export type Panel = 'chat' | 'history' | 'rss' | 'settings';

export const useUiStore = defineStore(
  'ui',
  () => {
    const activePanel = ref<Panel>('chat');
    const sidebarCollapsed = ref(false);
    const showTokenMetrics = ref(false);
    const selectedConversationId = ref<string | undefined>(undefined);
    const selectedFeedId = ref<string | undefined>(undefined);
    const historySearchKeyword = ref('');
    const deepSearchResults = ref<SearchResult[] | undefined>(undefined);

    function setPanel(panel: Panel) {
      activePanel.value = panel;
    }

    function selectConversation(id: string | undefined) {
      selectedConversationId.value = id;
    }

    function setHistorySearchKeyword(keyword: string) {
      historySearchKeyword.value = keyword;
    }

    function setDeepSearchResults(results: SearchResult[] | undefined) {
      deepSearchResults.value = results;
    }

    function reset() {
      activePanel.value = 'chat';
      sidebarCollapsed.value = false;
      showTokenMetrics.value = false;
      selectedConversationId.value = undefined;
      selectedFeedId.value = undefined;
      historySearchKeyword.value = '';
      deepSearchResults.value = undefined;
    }

    return {
      activePanel,
      sidebarCollapsed,
      showTokenMetrics,
      selectedConversationId,
      selectedFeedId,
      historySearchKeyword,
      deepSearchResults,
      setPanel,
      selectConversation,
      setHistorySearchKeyword,
      setDeepSearchResults,
      reset,
    };
  },
  {
    persist: {
      storage: chromeStorageLocal(STORE_KEYS.ui) as unknown as Storage,
      pick: [
        'activePanel',
        'sidebarCollapsed',
        'showTokenMetrics',
        'selectedConversationId',
        'selectedFeedId',
      ],
    },
  },
);
