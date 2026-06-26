import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
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
    name: 'PageMind',
    description: '一键提取网页正文，保存为 Markdown。本地存储，离线可用。',
    version: '1.0.0',
    permissions: ['activeTab', 'scripting', 'storage', 'sidePanel'],
    optional_host_permissions: ['<all_urls>'],
  },
});
