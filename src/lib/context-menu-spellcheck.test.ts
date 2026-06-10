// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  document.body.innerHTML = ''
  try {
    const storage = window.localStorage
    if (typeof storage?.clear === 'function') {
      storage.clear()
    } else if (storage && typeof storage.length === 'number') {
      for (let index = storage.length - 1; index >= 0; index -= 1) {
        const key = storage.key(index)
        if (key) {
          storage.removeItem(key)
        }
      }
    }
  } catch {
    // ignore storage cleanup failures in tests
  }
  vi.resetModules()
})

describe('context menu spellcheck', () => {
  it('includes suggestions for misspelled editable words', async () => {
    const input = document.createElement('input')
    input.value = 'teh'
    document.body.append(input)
    input.focus()
    input.setSelectionRange(3, 3)

    const { buildContextMenuRequest } = await import('./tauri-bridge')
    const request = await buildContextMenuRequest(input)

    expect(request.isEditable).toBe(true)
    expect(request.misspelledWord).toBe('teh')
    expect(request.dictionarySuggestions.length).toBeGreaterThan(0)
    expect(request.dictionarySuggestions).not.toContain('teh')
  })

  it('captures image/link targets and click coordinates for native context menus', async () => {
    document.body.innerHTML = `
      <div>
        <a href="https://example.com/article">
          <img alt="Hermes Logo" src="https://example.com/assets/hermes-logo.png" />
        </a>
      </div>
    `

    const image = document.querySelector('img')
    expect(image).toBeTruthy()

    const { buildContextMenuRequest } = await import('./tauri-bridge')
    const request = await buildContextMenuRequest(image, { x: 164, y: 72 })

    expect(request.imageUrl).toBe('https://example.com/assets/hermes-logo.png')
    expect(request.linkUrl).toBe('https://example.com/article')
    expect(request.suggestedName).toBe('hermes-logo.png')
    expect(request.x).toBe(164)
    expect(request.y).toBe(72)
  })

  it('suppresses words added to the custom dictionary', async () => {
    const input = document.createElement('input')
    input.value = 'teh'
    document.body.append(input)
    input.focus()
    input.setSelectionRange(3, 3)

    const { addWordToSpellcheckDictionary, buildContextMenuRequest } = await import('./tauri-bridge')
    await addWordToSpellcheckDictionary('teh')

    const request = await buildContextMenuRequest(input)

    expect(request.misspelledWord).toBeNull()
    expect(request.dictionarySuggestions).toEqual([])
  })
})
