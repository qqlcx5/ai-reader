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
});
