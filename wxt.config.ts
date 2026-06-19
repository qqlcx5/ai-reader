import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-vue', '@wxt-dev/unocss'],
  unocss: {
    excludeEntrypoints: ['background'],
  },
  manifest: {
    permissions: ['sidePanel', 'activeTab', 'storage'],
    side_panel: {
      default_path: 'sidepanel',
    },
    options_page: 'options',
    commands: {
      'summarize': {
        suggested_key: {
          default: 'Alt+S',
        },
        description: 'Summarize current page',
      },
      'toggle-panel': {
        suggested_key: {
          default: 'Alt+Shift+S',
        },
        description: 'Toggle side panel',
      },
      'abort-all': {
        description: 'Abort all streams',
      },
    },
  },
});
