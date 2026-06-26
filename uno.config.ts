import { defineConfig } from 'unocss'
import presetUno from '@unocss/preset-uno'

export default defineConfig({
  presets: [
    presetUno(),
  ],
  theme: {
    colors: {
      primary: {
        50: '#f0f9ff',
        100: '#e0f2fe',
        200: '#bae6fd',
        300: '#7dd3fc',
        400: '#38bdf8',
        500: '#0ea5e9',
        600: '#0284c7',
        700: '#0369a1',
        800: '#075985',
        900: '#0c4a6e',
      },
      surface: {
        50: '#fafafa',
        100: '#f5f5f5',
        200: '#e5e5e5',
        300: '#d4d4d4',
        400: '#a3a3a3',
        500: '#737373',
        600: '#525252',
        700: '#404040',
        800: '#262626',
        900: '#171717',
      },
    },
    fontFamily: {
      sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
    },
  },
  shortcuts: {
    'btn-primary': 'bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors',
    'btn-secondary': 'bg-surface-200 text-surface-800 px-4 py-2 rounded-lg hover:bg-surface-300 transition-colors',
    'card': 'bg-white dark:bg-surface-800 rounded-xl shadow-sm border border-surface-200 dark:border-surface-700',
    'input': 'w-full px-3 py-2 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 focus:outline-none focus:ring-2 focus:ring-primary-500',
  },
})
