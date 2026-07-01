import { defineConfig, presetWind3 } from 'unocss'

export default defineConfig({
  presets: [presetWind3()],
  // 缩小扫描范围，仅扫描源码目录，排除 node_modules / .output / .wxt 等
  content: {
    pipeline: {
      include: [
        /\.(vue|ts|html|css)($|\?)/,
      ],
    },
    filesystem: [
      'entrypoints/**/*.{ts,vue,html,css}',
      'components/**/*.{ts,vue}',
      'composables/**/*.ts',
      'services/**/*.ts',
      'stores/**/*.ts',
      'utils/**/*.ts',
      'db/**/*.ts',
      'types/**/*.ts',
      'data/**/*.ts',
      'assets/**/*',
    ],
  },
  theme: {
    fontFamily: {
      sans: 'Inter, system-ui, sans-serif',
      mono: 'JetBrains Mono, monospace',
    },
    colors: {
      brand: '#6366F1',
      primary: '#6C5CE7',
      secondary: '#00B894',
      accent: '#FDCB6E',
      surface: '#FAFAFA',
    },
  },
  shortcuts: {
    'glass': 'bg-white/78 backdrop-blur-[16px]',
    'soft-shadow': 'shadow-[0_18px_50px_rgba(24,24,27,0.16),0_2px_8px_rgba(24,24,27,0.08)]',
    'no-scrollbar': '[&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]',
  },
})
