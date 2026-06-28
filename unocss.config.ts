import { defineConfig, presetWind3 } from 'unocss'

export default defineConfig({
  presets: [presetWind3()],
  theme: {
    fontFamily: {
      sans: 'Inter, system-ui, sans-serif',
      mono: 'JetBrains Mono, monospace',
    },
    colors: {
      brand: '#6366F1',
    },
  },
  shortcuts: {
    'glass': 'bg-white/78 backdrop-blur-[16px]',
    'soft-shadow': 'shadow-[0_18px_50px_rgba(24,24,27,0.16),0_2px_8px_rgba(24,24,27,0.08)]',
    'no-scrollbar': '[&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]',
  },
})
