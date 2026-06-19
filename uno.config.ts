import { defineConfig, presetUno, presetTypography, presetIcons, transformerVariantGroup } from 'unocss';

export default defineConfig({
  presets: [
    presetUno(),
    presetTypography(),
    presetIcons({
      scale: 1.0,
      warn: true,
    }),
  ],
  transformers: [transformerVariantGroup()],
  theme: {
    colors: {
      // Semantic color tokens, mapped to CSS variables from theme.css
      app: 'var(--background-primary)',
      'app-alt': 'var(--background-primary-alt)',
      surface: 'var(--background-primary)',
      'surface-2': 'var(--background-secondary)',
      elevated: 'var(--color-base-30)',
      'elevated-hover': 'var(--color-base-35)',

      primary: {
        DEFAULT: 'var(--text-normal)',
        muted: 'var(--text-muted)',
        faint: 'var(--text-faint)',
        secondary: 'var(--text-normal)',
      },
      border: {
        DEFAULT: 'var(--background-modifier-border)',
        strong: 'var(--background-modifier-border-hover)',
        focus: 'var(--background-modifier-border-focus)',
      },
      accent: {
        DEFAULT: 'var(--interactive-accent)',
        hover: 'var(--interactive-accent-hover)',
        soft: 'var(--color-accent-soft)',
        'soft-hover': 'var(--color-accent-soft-hover)',
      },
      success: {
        DEFAULT: 'var(--text-success)',
        soft: 'var(--background-modifier-success)',
      },
      warning: {
        DEFAULT: 'var(--text-warning)',
        soft: 'var(--background-modifier-warning)',
      },
      danger: {
        DEFAULT: 'var(--text-error)',
        soft: 'var(--background-modifier-error)',
      },
    },
    ringColor: {
      DEFAULT: 'var(--background-modifier-border-focus)',
      accent: 'var(--interactive-accent)',
    },
  },
  shortcuts: {
    // === Buttons (Obsidian style) ===
    'btn-base': 'inline-flex items-center justify-center gap-1.5 font-medium rounded-[var(--radius-s)] [corner-shape:var(--corner-shape)] transition-[box-shadow,background-color,color] duration-150 focus-visible:outline-none disabled:opacity-60 disabled:cursor-not-allowed select-none whitespace-nowrap',
    'btn-sm': 'h-[1.625rem] px-2 py-0 text-[var(--font-ui-smaller)]',
    'btn-md': 'h-[var(--input-height)] px-3 text-[var(--font-ui-smaller)]',
    'btn-lg': 'h-10 px-4 text-[var(--font-ui-small)]',

    // Non-CTA button (transparent, used in headers) — Obsidian style
    'btn': 'btn-base btn-md bg-[var(--background-primary)] text-[var(--text-normal)] shadow-[var(--input-shadow)] hover:bg-[var(--interactive-hover)] hover:shadow-[var(--input-shadow-hover)] active:shadow-[var(--input-shadow-focus)] focus-visible:shadow-[var(--input-shadow-focus)]',

    'btn-primary': 'btn-base btn-md bg-[var(--interactive-accent)] text-[var(--text-on-accent)] shadow-[inset_0_0_0_1px_rgba(var(--mono-rgb-100),0.12)] hover:bg-[var(--interactive-accent-hover)] active:shadow-[var(--input-shadow-focus)] focus-visible:shadow-[var(--input-shadow-focus)]',
    'btn-primary-sm': 'btn-base btn-sm bg-[var(--interactive-accent)] text-[var(--text-on-accent)] shadow-[inset_0_0_0_1px_rgba(var(--mono-rgb-100),0.12)] hover:bg-[var(--interactive-accent-hover)] active:shadow-[var(--input-shadow-focus)]',
    'btn-primary-lg': 'btn-base btn-lg bg-[var(--interactive-accent)] text-[var(--text-on-accent)] shadow-[inset_0_0_0_1px_rgba(var(--mono-rgb-100),0.12)] hover:bg-[var(--interactive-accent-hover)] active:shadow-[var(--input-shadow-focus)]',

    'btn-secondary': 'btn-base btn-md bg-[var(--background-primary)] text-[var(--text-normal)] shadow-[var(--input-shadow)] hover:bg-[var(--interactive-hover)] hover:shadow-[var(--input-shadow-hover)] active:shadow-[var(--input-shadow-focus)]',
    'btn-secondary-sm': 'btn-base btn-sm bg-[var(--background-primary)] text-[var(--text-normal)] shadow-[var(--input-shadow)] hover:bg-[var(--interactive-hover)] hover:shadow-[var(--input-shadow-hover)]',
    'btn-ghost': 'btn-base btn-md text-[var(--text-muted)] hover:bg-[var(--background-modifier-hover)] hover:text-[var(--text-normal)]',
    'btn-ghost-sm': 'btn-base btn-sm text-[var(--text-muted)] hover:bg-[var(--background-modifier-hover)] hover:text-[var(--text-normal)]',
    'btn-danger': 'btn-base btn-md bg-[var(--text-error)] text-white hover:opacity-90 active:shadow-[var(--input-shadow-focus)]',
    'btn-danger-sm': 'btn-base btn-sm bg-[var(--text-error)] text-white hover:opacity-90',

    // === Clickable icon (used in header action rows) ===
    'clickable-icon': 'inline-flex items-center justify-center bg-transparent text-[var(--text-muted)] opacity-85 rounded-[var(--radius-m)] [corner-shape:var(--corner-shape)] cursor-default w-[var(--clickable-icon-size)] h-[var(--clickable-icon-size)] hover:bg-[var(--background-modifier-hover)] hover:text-[var(--text-normal)] hover:opacity-100 transition-colors duration-[var(--duration-fast)]',
    'clickable-icon-active': 'clickable-icon !bg-[var(--color-accent-soft)] !text-[var(--text-accent)] hover:!bg-[var(--color-accent-soft-hover)]',

    // === Inputs (Obsidian style with subtle inset shadow) ===
    'input-base': 'w-full bg-[var(--background-modifier-form-field)] border border-[var(--background-modifier-border)] rounded-[var(--radius-s)] [corner-shape:var(--corner-shape)] text-[var(--text-normal)] placeholder:text-[var(--text-faint)] outline-none transition-[box-shadow,border-color] duration-[var(--duration-fast)] hover:border-[var(--background-modifier-border-hover)] focus:border-[var(--background-modifier-border-focus)] focus:shadow-[var(--input-shadow-focus)] focus-visible:shadow-[var(--input-shadow-focus)]',
    'input-md': 'input-base h-[var(--input-height)] px-2 text-[var(--font-ui-smaller)]',
    'input-sm': 'input-base h-[1.5rem] px-1.5 text-xs',
    'textarea-base': 'input-base min-h-[3rem] p-1.5 text-[var(--font-ui-smaller)] resize-y',

    // === Select (Obsidian style with custom chevron — chevron defined in theme.css) ===
    'select-base': 'appearance-none select-chevron bg-[var(--background-modifier-form-field)] border border-[var(--background-modifier-border)] rounded-[var(--radius-s)] [corner-shape:var(--corner-shape)] h-[var(--input-height)] pl-2 pr-7 text-[var(--font-ui-smaller)] text-[var(--text-normal)] outline-none transition-[box-shadow,border-color] duration-[var(--duration-fast)] hover:border-[var(--background-modifier-border-hover)] focus:border-[var(--background-modifier-border-focus)] focus:shadow-[var(--input-shadow-focus)] cursor-pointer select-none w-full',

    // === Cards / Setting items container (Obsidian style) ===
    'setting-group': 'space-y-2',
    'setting-items': 'bg-[var(--background-primary)] border border-[var(--background-modifier-border)] rounded-[var(--radius-m)] [corner-shape:var(--corner-shape)] p-0 overflow-hidden',
    'setting-item': 'flex items-start gap-2 px-4 py-2.5 text-[var(--font-ui-small)] border-b border-[var(--background-modifier-border)] last:border-b-0',
    'setting-item-mod-horizontal': 'flex flex-row items-center justify-between gap-4 px-4 py-2.5 text-[var(--font-ui-small)] border-b border-[var(--background-modifier-border)] last:border-b-0',
    'setting-item-info': 'flex-1 min-w-0',
    'setting-item-label': 'text-[var(--font-ui-small)] text-[var(--text-normal)] font-normal',
    'setting-item-description': 'text-[var(--font-ui-smallest)] text-[var(--text-muted)] leading-snug mt-0.5',
    'setting-item-control': 'flex items-center gap-2 shrink-0',

    // === Section header ===
    'section-header': 'flex items-center justify-between mb-3',
    'section-title': 'text-lg font-semibold text-[var(--text-normal)]',
    'section-subtitle': 'text-[var(--font-ui-small)] text-[var(--text-muted)] mt-0.5',

    // === Sidebar (Obsidian settings style) ===
    'app-sidebar': 'flex flex-col w-[var(--sidebar-width,260px)] shrink-0 border-r border-[var(--background-modifier-border)] bg-[var(--background-primary)] overflow-y-auto p-4',
    'nav-list': 'flex flex-col gap-0.5 list-none p-0 m-0 text-[var(--font-ui-small)]',
    'nav-item': 'flex items-center gap-2 px-2 py-1.5 rounded-[var(--radius-s)] [corner-shape:var(--corner-shape)] cursor-pointer text-[var(--text-muted)] hover:bg-[var(--background-modifier-hover)] hover:text-[var(--text-normal)] select-none',
    'nav-item-active': 'nav-item bg-[var(--background-modifier-hover)] text-[var(--text-normal)]',

    // === Card surfaces (for sidepanel content) ===
    'surface-card': 'bg-[var(--background-primary)] border border-[var(--background-modifier-border)] rounded-[var(--radius-m)] [corner-shape:var(--corner-shape)]',

    // === Menu / Dropdown ===
    'menu': 'absolute z-50 min-w-[180px] bg-[var(--background-primary)] border border-[var(--background-modifier-border-hover)] rounded-[var(--radius-s)] [corner-shape:var(--corner-shape)] shadow-[var(--shadow-s)] p-1 flex flex-col',
    'menu-item': 'flex items-center gap-2 px-2 py-1.5 text-[var(--font-ui-smaller)] text-[var(--text-normal)] rounded-[var(--radius-s)] [corner-shape:var(--corner-shape)] cursor-pointer hover:bg-[var(--background-modifier-hover)] whitespace-nowrap',

    // === Toggle (iOS-style checkbox-container) ===
    'toggle-track': 'inline-block relative shrink-0 w-10 h-5 rounded-full [corner-shape:var(--corner-shape)] bg-[var(--background-modifier-border-hover)] cursor-pointer transition-[background-color,box-shadow] duration-150 shadow-[inset_0_4px_10px_rgba(0,0,0,0.07),inset_0_0_1px_rgba(0,0,0,0.21)]',
    'toggle-track-on': '!bg-[var(--interactive-accent)]',
    'toggle-thumb': 'absolute top-1/2 -translate-y-1/2 left-0.5 w-4 h-4 rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.15)] transition-transform duration-150 pointer-events-none',

    // === Checkbox ===
    'checkbox-base': 'appearance-none w-4 h-4 border border-[var(--background-modifier-border)] rounded-[var(--radius-s)] [corner-shape:var(--corner-shape)] bg-[var(--background-modifier-form-field)] shrink-0 relative cursor-pointer transition-[box-shadow,background-color,border-color] duration-150 checked:bg-[var(--interactive-accent)] checked:border-[var(--interactive-accent)] hover:border-[var(--background-modifier-border-focus)] focus-visible:shadow-[var(--input-shadow-focus)]',

    // === Badges / Pills ===
    'pill': 'inline-flex items-center gap-1 px-1.5 py-0.5 text-[var(--font-ui-smallest)] font-medium rounded-[var(--radius-s)] [corner-shape:var(--corner-shape)]',
    'pill-accent': 'pill bg-[var(--color-accent-soft)] text-[var(--text-accent)]',
    'pill-success': 'pill bg-[var(--background-modifier-success)] text-[var(--text-success)]',
    'pill-warning': 'pill bg-[var(--background-modifier-warning)] text-[var(--text-warning)]',
    'pill-danger': 'pill bg-[var(--background-modifier-error)] text-[var(--text-error)]',
    'pill-neutral': 'pill bg-[var(--background-secondary)] text-[var(--text-muted)]',

    // === Stack helpers ===
    'stack-1': 'space-y-1',
    'stack-2': 'space-y-2',
    'stack-3': 'space-y-3',
    'stack-4': 'space-y-4',
    'stack-6': 'space-y-6',
    'divider': 'border-t border-[var(--background-modifier-border)]',
    'divider-subtle': 'border-t border-[var(--color-base-20)]',

    // === Empty / Error states ===
    'state-center': 'flex flex-col items-center justify-center text-center p-8 gap-2',
  },
  safelist: [
    'i-lucide-loader', 'i-lucide-loader-circle', 'animate-spin',
    'toggle-track-on',
  ],
});
