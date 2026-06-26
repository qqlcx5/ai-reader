import { defineConfig } from 'wxt';
import UnoCSS from 'unocss/vite';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-vue'],
  manifest: {
    name: 'AI Reader',
    description: 'AI-powered web page reader with chat, search, and sync capabilities',
    version: '0.1.0',
    permissions: [
      'sidePanel',
      'storage',
      'activeTab',
      'scripting',
    ],
    host_permissions: [
      '<all_urls>',
      'http://*/*',
      'https://*/*',
    ],
    side_panel: {
      default_path: 'sidepanel.html',
    },
    options_ui: {
      page: 'options.html',
      open_in_tab: true,
    },
    icons: {
      '16': 'icon/16.png',
      '48': 'icon/48.png',
      '128': 'icon/128.png',
    },
    action: {
      default_popup: 'popup.html',
    },
    content_security_policy: {
      extension_pages: "script-src 'self'; object-src 'self'",
    },
    web_accessible_resources: [
      {
        resources: ['assets/*'],
        matches: ['*://*/*'],
      },
    ],
  },
  webExt: {
    chromiumArgs: ['--user-data-dir=./.wxt/chrome-data'],
  },
  vite: () => ({
    plugins: [UnoCSS()],
    resolve: {
      alias: {
        '@': '/',
        '@core': '/core',
        '@db': '/db',
        '@shared': '/shared',
        '@components': '/components',
        '@styles': '/styles',
      },
    },
  }),
});
