import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, '.'),
    },
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ["./test-setup.ts"],
    exclude: ["reference/**", ".claude/**", "node_modules/**", ".tmp-tests/**"],
  },
});
