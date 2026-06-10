import { readFileSync } from 'node:fs'

import { describe, expect, test } from 'vitest'

const SETTINGS_THEME_FILES = [
  'about-settings.tsx',
  'gateway-settings.tsx',
  'keys-settings.tsx',
  'mcp-settings.tsx',
  'model-settings.tsx',
  'providers-settings.tsx',
  'toolset-config-panel.tsx'
] as const

describe('theme surface regressions', () => {
  test('workbench surface tokens stay derived from theme-driven ui variables', () => {
    const source = readFileSync(new URL('../../styles.css', import.meta.url), 'utf8')

    expect(source).toContain('--workbench-shell-bg: var(--ui-bg-chrome);')
    expect(source).toContain('--workbench-panel-bg: color-mix(in srgb, var(--ui-bg-editor) 96%, transparent);')
    expect(source).toContain('--workbench-divider: var(--ui-stroke-secondary);')
  })

  test.each(SETTINGS_THEME_FILES)('%s avoids light-only white surface mixes', fileName => {
    const source = readFileSync(new URL(`./${fileName}`, import.meta.url), 'utf8')

    expect(source).not.toContain('white_')
  })

  test('image generation placeholder avoids light-only white shadow mixes', () => {
    const source = readFileSync(
      new URL('../../components/chat/image-generation-placeholder.tsx', import.meta.url),
      'utf8'
    )

    expect(source).not.toContain('white_')
  })
})
