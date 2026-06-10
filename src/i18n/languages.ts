import type { Locale } from './types'

export const DEFAULT_LOCALE: Locale = 'en'

export const LOCALE_OPTIONS = [
  { id: 'en', name: 'English', englishName: 'English', configValue: 'en' },
  { id: 'zh', name: '简体中文', englishName: 'Simplified Chinese', configValue: 'zh' },
  { id: 'zh-hant', name: '繁體中文', englishName: 'Traditional Chinese', configValue: 'zh-hant' },
  { id: 'ja', name: '日本語', englishName: 'Japanese', configValue: 'ja' }
] as const satisfies readonly { configValue: string; englishName: string; id: Locale; name: string }[]

export const LOCALE_META: Record<Locale, { englishName: string; name: string }> = Object.fromEntries(
  LOCALE_OPTIONS.map(locale => [locale.id, { englishName: locale.englishName, name: locale.name }])
) as Record<Locale, { englishName: string; name: string }>

const LOCALE_ALIASES: Record<string, Locale> = {
  en: 'en',
  'en-us': 'en',
  en_us: 'en',
  ja: 'ja',
  'ja-jp': 'ja',
  ja_jp: 'ja',
  zh: 'zh',
  'zh-cn': 'zh',
  zh_cn: 'zh',
  'zh-hans': 'zh',
  zh_hans: 'zh',
  'zh-hans-cn': 'zh',
  zh_hans_cn: 'zh',
  'zh-hant': 'zh-hant',
  zh_hant: 'zh-hant',
  'zh-hant-hk': 'zh-hant',
  zh_hant_hk: 'zh-hant',
  'zh-hant-tw': 'zh-hant',
  zh_hant_tw: 'zh-hant',
  'zh-hk': 'zh-hant',
  zh_hk: 'zh-hant',
  'zh-mo': 'zh-hant',
  zh_mo: 'zh-hant',
  'zh-tw': 'zh-hant',
  zh_tw: 'zh-hant'
}

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && LOCALE_OPTIONS.some(locale => locale.id === value)
}

export function normalizeLocale(value: unknown): Locale {
  if (typeof value !== 'string') {
    return DEFAULT_LOCALE
  }

  return LOCALE_ALIASES[value.trim().toLowerCase()] ?? DEFAULT_LOCALE
}

export function isSupportedLocaleValue(value: unknown): boolean {
  return typeof value === 'string' && LOCALE_ALIASES[value.trim().toLowerCase()] != null
}

export function localeConfigValue(locale: Locale): string {
  return LOCALE_OPTIONS.find(item => item.id === locale)?.configValue ?? DEFAULT_LOCALE
}
