// ============================================================
// I18n — lightweight translation function
// ============================================================

import zhCN from './locales/zh-CN.json';

type LocaleData = typeof zhCN;

const locales: Record<string, LocaleData> = {
  'zh-CN': zhCN,
};

let currentLang = 'zh-CN';

/**
 * Set the active locale.
 */
export function setLocale(lang: string): void {
  if (locales[lang]) {
    currentLang = lang;
  }
}

/**
 * Get the current locale code.
 */
export function getLocale(): string {
  return currentLang;
}

/**
 * Translate a dotted key path to a localized string.
 * Supports interpolation with `{{var}}` placeholders.
 *
 * @example t('export.title') => '导出文章'
 * @example t('export.batch_export_all', { count: 5 }) => '导出全部 (5 篇)'
 */
export function t(key: string, vars?: Record<string, string | number>): string {
  const locale = locales[currentLang] ?? locales['zh-CN'];
  const value = getNestedValue(locale, key);
  let result = typeof value === 'string' ? value : key;

  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      result = result.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v));
    }
  }

  return result;
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const keys = path.split('.');
  let current: any = obj;
  for (const k of keys) {
    if (current == null || typeof current !== 'object') return undefined;
    current = current[k];
  }
  return current;
}
