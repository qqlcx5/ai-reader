import { defineConfig, presetUno } from 'unocss';

export default defineConfig({
  presets: [presetUno()],
  theme: {
    colors: {
      bg: '#f6f6f4',
      card: 'rgba(255,255,255,0.78)',
      text: '#1d1d1f',
      blue: '#2563eb',
    },
    borderRadius: {
      card: '20px',
      button: '16px',
      shell: '32px',
    },
  },
  shortcuts: {
    'card': 'bg-card rounded-card',
    'btn': 'bg-blue text-white rounded-button px-4 py-2 cursor-pointer',
    'shell': 'bg-bg rounded-shell',
  },
});
