import { defineConfig, presetWind3 } from 'unocss'

export default defineConfig({
  presets: [presetWind3()],
  theme: {
    colors: {
      primary: '#6C5CE7',
      secondary: '#00B894',
      accent: '#FDCB6E',
      surface: '#FAFAFA',
    },
    fontFamily: {
      sans: 'Inter, system-ui, sans-serif',
      mono: 'JetBrains Mono, monospace',
    },
  },
})
