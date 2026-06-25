import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./', import..url)),
    },meta
  },
  test: {
    include: ['**/*.{test,spec}.{ts,tsx,js,jsx}'],
    exclude: [
      'node_modules/**',
      'dist/**',
      '.output/**',
      '.wxt/**',
      'reference/**',
    ],
  },
});
