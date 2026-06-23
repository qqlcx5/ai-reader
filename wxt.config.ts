import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-vue'],
  manifest: {
    name: 'AI Reader',
    description: 'AI-powered web page reader with multi-model workspace, workflows, and RSS.',
    permissions: [
      'storage',
      'tabs',
      'activeTab',
      'scripting',
      'sidePanel',
      'contextMenus',
      'notifications',
      'alarms',
    ],
    host_permissions: ['<all_urls>'],
    commands: {
      'open-side-panel': {
        suggested_key: { default: 'Alt+S' },
        description: 'Open side panel and extract current page',
      },
      'toggle-side-panel': {
        suggested_key: { default: 'Alt+P' },
        description: 'Toggle side panel visibility',
      }
    },
    side_panel: {
      default_path: 'sidepanel.html',
    },
    options_ui: {
      page: 'options.html',
      open_in_tab: true,
    },
  },
  webExt: {
    // 持久化 profile 到项目目录下，避免每次创建临时 profile
    // 需要清除缓存时，删除 .wxt/chrome-data 目录即可
    chromiumArgs: ['--user-data-dir=./.wxt/chrome-data'],
  },
  vite: () => ({
    css: {
      preprocessorOptions: {},
    },
  }),
});
