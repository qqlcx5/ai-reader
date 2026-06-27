import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import path from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: [
      'components/**/*.test.ts',
      'stores/**/*.test.ts',
      'db/**/*.test.ts',
      'services/**/*.test.ts',
      'utils/**/*.test.ts',
      'types/**/*.test.ts',
    ],
  },
})
