import { atom } from 'nanostores'

export const $commandPaletteOpen = atom(false)

export function openCommandPalette(): void {
  $commandPaletteOpen.set(true)
}

export function closeCommandPalette(): void {
  $commandPaletteOpen.set(false)
}

export function setCommandPaletteOpen(open: boolean): void {
  $commandPaletteOpen.set(open)
}

export function toggleCommandPalette(): void {
  $commandPaletteOpen.set(!$commandPaletteOpen.get())
}
