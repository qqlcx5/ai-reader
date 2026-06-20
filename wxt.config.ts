import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-vue', '@wxt-dev/unocss'],
  unocss: {
    excludeEntrypoints: ['background'],
  },
  manifest: {
    name: 'AI Reader',
    description: 'Multi-model AI reading assistant with side-by-side comparison',
    version: '1.0.0',
    permissions: ['sidePanel', 'activeTab', 'storage', 'alarms'],
    host_permissions: ['http://*/*', 'https://*/*'],
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
