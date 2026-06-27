import { defineConfig } from 'wxt'

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-vue', '@wxt-dev/unocss'],
  manifest: {
    name: 'AuraMind',
    permissions: ['sidePanel', 'activeTab', 'scripting', 'storage', 'tabs'],
    host_permissions: ['<all_urls>'],
  },
  unocss: {
    excludeEntrypoints: ['background'],
  },
  webExt: {
    chromiumArgs: ['--user-data-dir=./.wxt/chrome-data'],
    openDevtools: true,
  },
})
