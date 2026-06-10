import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { TRANSLATIONS } from './catalog'
import { setRuntimeI18nLocale, translateNow } from './runtime'

describe('desktop i18n runtime translator', () => {
  beforeEach(() => {
    setRuntimeI18nLocale('en')
  })

  afterEach(() => {
    setRuntimeI18nLocale('en')
  })

  it('translates string paths for the active runtime locale', () => {
    setRuntimeI18nLocale('zh')

    expect(translateNow('language.label')).toBe('语言')
    expect(translateNow('composer.lookupNoMatches')).toBe('没有匹配项。')
    expect(translateNow('common.copy')).toBe('复制')
  })

  it('passes arguments to function translations', () => {
    expect(translateNow('settings.gateway.profileConnection', 'default')).toBe(
      'Only the "default" profile will use this remote connection override.'
    )
  })

  it('translates migrated overlap keys for newly supported locales', () => {
    setRuntimeI18nLocale('ja')
    expect(translateNow('common.save')).toBe('Save')
    expect(translateNow('common.copy')).toBe('コピー')

    setRuntimeI18nLocale('zh-hant')
    expect(translateNow('common.copy')).toBe('複製')
    expect(translateNow('composer.lookupNoMatches')).toBe('沒有匹配項。')
  })

  it('falls back to English when the active locale cannot resolve a key', () => {
    const language = TRANSLATIONS.ja.language as { label?: string }
    const originalLabel = language.label

    try {
      language.label = undefined
      setRuntimeI18nLocale('ja')

      expect(translateNow('language.label')).toBe('Language')
    } finally {
      language.label = originalLabel
    }
  })

  it('returns the key when no locale can resolve a path', () => {
    setRuntimeI18nLocale('zh')

    expect(translateNow('missing.path')).toBe('missing.path')
  })
})
