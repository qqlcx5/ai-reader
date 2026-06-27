import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-vue', '@wxt-dev/unocss'],
  unocss: {
    excludeEntrypoints: ['background'],
  },
  webExt: {
    chromiumArgs: ['--user-data-dir=./.wxt/chrome-data'],
    openDevtools: true,
  },
  manifest: {
    name: 'SuperBrain',
    description: 'Local-First AI Web Clipper — capture, organize, and chat with web articles',
    version: '0.7.0',
    permissions: [
      'activeTab',
      'scripting',
      'storage',
      'sidePanel',
      'tabs',
      'downloads',
    ],
    host_permissions: ['<all_urls>'],
    side_panel: {
      default_path: 'sidepanel.html',
    },
    options_ui: {
      page: 'options.html',
      open_in_tab: true,
    },
    content_security_policy: {
      extension_pages: "script-src 'self'; object-src 'self'",
    },
  },
});
