import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  root: 'src/web',
  plugins: [vue()],
  build: {
    outDir: '../../web-dist',
    emptyOutDir: true,
  },
})
