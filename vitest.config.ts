import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': new URL('.', import.meta.url).pathname,
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: [
      'core/**/*.test.ts',
      'core/**/*.spec.ts',
      'db/**/*.test.ts',
      'entrypoints/**/__tests__/**/*.test.ts',
    ],
    exclude: ['reference/**', 'node_modules/**'],
  },
});
