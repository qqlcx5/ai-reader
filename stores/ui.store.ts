import { computed, ref } from 'vue';
import { defineStore } from 'pinia';

export type Panel = 'chat' | 'history' | 'rss' | 'settings';

export type AppRoute = 'home' | 'history' | 'settings' | 'workflows' | 'rss';
export type Theme = 'light' | 'dark';

export interface CurrentContextMeta {
  tabId: number | null;
  url: string;
  title: string;
  wordCount: number;
  extractedAt: number;
  status: 'idle' | 'extracting' | 'ready' | 'error';
}

export const useUiStore = defineStore(
  'ui',
  () => {
    const activePanel = ref<Panel>('chat');
    const activeRoute = ref<AppRoute>('home');
    const sidebarCollapsed = ref(false);
    const showTokenMetrics = ref(false);
    const sidePanelOpen = ref(false);
    const shortcutEnabled = ref(true);
    const theme = ref<Theme>('light');
    const selectedConversationId = ref<string | undefined>(undefined);
    const selectedFeedId = ref<string | undefined>(undefined);
    const historySearchKeyword = ref('');
    const deepSearchResults = ref<unknown[] | undefined>(undefined);

    function setPanel(panel: Panel) {
      activePanel.value = panel;
    }

    function setRoute(route: AppRoute) {
      activeRoute.value = route;
    }

    function setSidePanelOpen(open: boolean) {
      sidePanelOpen.value = open;
    }

    function setShortcutEnabled(enabled: boolean) {
      shortcutEnabled.value = enabled;
    }

    function setTheme(next: Theme) {
      theme.value = next;
      if (typeof document !== 'undefined') {
        document.documentElement.dataset.theme = next;
      }
    }

    function toggleTheme() {
      setTheme(theme.value === 'light' ? 'dark' : 'light');
    }

    function selectConversation(id: string | undefined) {
      selectedConversationId.value = id;
    }

    function setHistorySearchKeyword(keyword: string) {
      historySearchKeyword.value = keyword;
    }

    function setDeepSearchResults(results: unknown[] | undefined) {
      deepSearchResults.value = results;
    }

    function reset() {
      activePanel.value = 'chat';
      activeRoute.value = 'home';
      sidebarCollapsed.value = false;
      showTokenMetrics.value = false;
      sidePanelOpen.value = false;
      theme.value = 'light';
      if (typeof document !== 'undefined') {
        document.documentElement.dataset.theme = 'light';
      }
      selectedConversationId.value = undefined;
      selectedFeedId.value = undefined;
      historySearchKeyword.value = '';
      deepSearchResults.value = undefined;
    }

    const isDark = computed(() => theme.value === 'dark');

    return {
      activePanel,
      activeRoute,
      sidebarCollapsed,
      showTokenMetrics,
      sidePanelOpen,
      shortcutEnabled,
      theme,
      selectedConversationId,
      selectedFeedId,
      historySearchKeyword,
      deepSearchResults,
      isDark,
      setPanel,
      setRoute,
      setSidePanelOpen,
      setShortcutEnabled,
      setTheme,
      toggleTheme,
      selectConversation,
      setHistorySearchKeyword,
      setDeepSearchResults,
      reset,
    };
  },
  {
    persist: {
      key: (id: string) => `pinia-${id}`,
      pick: [
        'activePanel',
        'activeRoute',
        'sidebarCollapsed',
        'showTokenMetrics',
        'sidePanelOpen',
        'shortcutEnabled',
        'theme',
        'selectedConversationId',
        'selectedFeedId',
      ],
    },
  },
);
