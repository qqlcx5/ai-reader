import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, '.'),
      '@db': resolve(__dirname, './db'),
      '@core': resolve(__dirname, './core'),
      '@shared': resolve(__dirname, './shared'),
      '@stores': resolve(__dirname, './stores'),
      '@components': resolve(__dirname, './components'),
    },
  },
});
