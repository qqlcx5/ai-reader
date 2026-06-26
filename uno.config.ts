import {
  defineConfig,
  presetUno,
  presetWebFonts,
  presetIcons,
} from 'unocss';

export default defineConfig({
  presets: [
    presetUno(),
    presetWebFonts({
      fonts: {
        sans: 'Inter',
        mono: 'JetBrains Mono',
      },
    }),
    presetIcons(),
  ],
  theme: {
    colors: {
      brand: {
        50: '#f5f3ff',
        100: '#ede9fe',
        200: '#ddd6fe',
        300: '#c4b5fd',
        400: '#a78bfa',
        500: '#6366f1',
        600: '#4f46e5',
        700: '#4338ca',
        800: '#3730a3',
        900: '#312e81',
      },
      slate: {
        50: '#f8fafc',
        100: '#f1f5f9',
        200: '#e2e8f0',
        300: '#cbd5e1',
        400: '#94a3b8',
        500: '#64748b',
        600: '#475569',
        700: '#334155',
        800: '#1e293b',
        900: '#0f172a',
      },
    },
    borderRadius: {
      sm: '4px',
      DEFAULT: '6px',
      md: '8px',
      lg: '12px',
      xl: '16px',
    },
  },
  shortcuts: {
    'card': 'bg-white rounded-lg border border-slate-200 shadow-sm',
    'card-hover': 'card hover:border-brand-300 hover:shadow-md transition-all',
    'input': 'w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 disabled:opacity-50 disabled:cursor-not-allowed',
    'btn-primary': 'px-4 py-2 bg-brand-500 text-white rounded-md text-sm font-medium hover:bg-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors',
    'btn-secondary': 'px-4 py-2 bg-slate-100 text-slate-700 rounded-md text-sm font-medium hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors',
    'btn-ghost': 'px-4 py-2 text-slate-600 rounded-md text-sm font-medium hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors',
    'btn-danger': 'px-4 py-2 bg-red-500 text-white rounded-md text-sm font-medium hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors',
    'icon-btn': 'p-1.5 rounded-md text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors',
  },
});
