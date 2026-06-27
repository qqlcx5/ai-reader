// ============================================================
// SuperBrain I18n — Global Translation Composable
// ============================================================

import { ref } from 'vue'
import zhCN from './locales/zh-CN.json'
import en from './locales/en.json'

type Locale = 'zh-CN' | 'en'
type NestedDict = Record<string, unknown>

const currentLocale = ref<Locale>('zh-CN')

const bundles: Record<Locale, NestedDict> = {
  'zh-CN': zhCN as NestedDict,
  en: en as NestedDict,
}

/**
 * Look up a nested key like "reader.copied" from a locale bundle.
 */
function lookup(bundle: NestedDict, key: string): string {
  const parts = key.split('.')
  let node: unknown = bundle
  for (const p of parts) {
    if (node == null || typeof node !== 'object') return key
    node = (node as Record<string, unknown>)[p]
  }
  return typeof node === 'string' ? node : key
}

/**
 * Interpolate `{{var}}` placeholders.
 */
function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template
  return template.replace(/\{\{(\w+)\}\}/g, (_, name: string) =>
    String(vars[name] ?? `{{${name}}}`),
  )
}

/**
 * Global translation function. Falls back to key if missing.
 */
export function t(key: string, vars?: Record<string, string | number>): string {
  const raw = lookup(bundles[currentLocale.value], key)
  return interpolate(raw, vars)
}

/**
 * Set active locale. Automatically persists to localStorage.
 */
export function setLocale(locale: Locale): void {
  currentLocale.value = locale
  try { localStorage.setItem('superbrain-locale', locale) } catch {}
  document.documentElement.lang = locale === 'zh-CN' ? 'zh' : 'en'
}

/** Get current locale. */
export function getLocale(): Locale {
  return currentLocale.value
}

/**
 * Vue composable: returns reactive locale + t function for templates.
 */
export function useI18n() {
  return { t, locale: currentLocale, setLocale, getLocale }
}

/**
 * Initialize locale from localStorage or browser preference on app start.
 * Call once in App.vue onMounted.
 */
export function initLocale(): void {
  try {
    const stored = localStorage.getItem('superbrain-locale')
    if (stored === 'zh-CN' || stored === 'en') {
      setLocale(stored)
      return
    }
  } catch {}
  // Fallback: detect from browser
  const navLang = navigator.language
  if (navLang.startsWith('zh')) {
    setLocale('zh-CN')
  } else {
    setLocale('en')
  }
}
