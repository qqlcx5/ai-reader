import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    include: [
      'modules/**/*.{test,spec}.{ts,js}',
      'lib/**/*.{test,spec}.{ts,js}',
      'stores/**/*.{test,spec}.{ts,js}',
      'utils/**/*.{test,spec}.{ts,js}',
      'components/**/*.{test,spec}.{ts,js}',
    ],
    exclude: [
      'reference/**/*',
      'node_modules/**/*',
      '.output/**/*',
      'modules/workspace/**/*', // real suite lives at lib/workspace/__tests__
      'modules/workflow/**/*', // real suite lives at lib/workflow/__tests__
    ],
  },
});
