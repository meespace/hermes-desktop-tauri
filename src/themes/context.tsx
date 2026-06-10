/**
 * Desktop theme context.
 *
 * Applies the active theme as CSS custom properties on :root so every
 * Tailwind utility that references a color or font-family token picks up
 * the change automatically.
 *
 * Mode (light/dark/system) controls brightness; skin controls accent.
 * The two are persisted independently. Shift+X toggles light/dark.
 */

import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react'

import { matchesQuery, useMediaQuery } from '@/hooks/use-media-query'

import { BUILTIN_THEME_LIST, BUILTIN_THEMES, DEFAULT_SKIN_NAME, DEFAULT_TYPOGRAPHY, nousTheme } from './presets'
import type { DesktopTheme, DesktopThemeColors } from './types'

const SKIN_KEY = 'hermes-desktop-theme-v2'
const MODE_KEY = 'hermes-desktop-mode-v1'
const RETIRED_SKINS = new Set(['nous-light', 'default', 'gold'])

export type ThemeMode = 'light' | 'dark' | 'system'

const INJECTED_FONT_URLS = new Set<string>()

const resolveMode = (mode: ThemeMode, systemDark = matchesQuery('(prefers-color-scheme: dark)')): 'light' | 'dark' =>
  mode === 'system' ? (systemDark ? 'dark' : 'light') : mode

const normalizeSkin = (name: string | null | undefined): string =>
  name && BUILTIN_THEMES[name] && !RETIRED_SKINS.has(name) ? name : DEFAULT_SKIN_NAME

// ─── Color math (for synthesised light variants of dark-only skins) ────────

function hexToRgb(hex: string): [number, number, number] | null {
  const clean = hex.trim().replace(/^#/, '')

  if (!/^[0-9a-f]{6}$/i.test(clean)) {
    return null
  }

  return [0, 2, 4].map(i => parseInt(clean.slice(i, i + 2), 16)) as [number, number, number]
}

const rgbToHex = ([r, g, b]: [number, number, number]) =>
  `#${[r, g, b].map(n => Math.round(n).toString(16).padStart(2, '0')).join('')}`

function mix(a: string, b: string, amount: number): string {
  const ar = hexToRgb(a)
  const br = hexToRgb(b)

  return ar && br
    ? rgbToHex([ar[0] + (br[0] - ar[0]) * amount, ar[1] + (br[1] - ar[1]) * amount, ar[2] + (br[2] - ar[2]) * amount])
    : a
}

const cssMix = (base: string, overlay: string, overlayPct: number) =>
  `color-mix(in srgb, ${overlay} ${Math.round(overlayPct * 100)}%, ${base})`

function readableOn(hex: string): string {
  const rgb = hexToRgb(hex)

  if (!rgb) {
    return '#ffffff'
  }

  const [r, g, b] = rgb.map(v => {
    const c = v / 255

    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })

  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.58 ? '#161616' : '#ffffff'
}

function synthLightColors(seed: DesktopTheme): DesktopThemeColors {
  const accent = seed.colors.ring || seed.colors.primary
  const soft = mix('#ffffff', accent, 0.1)
  const softer = mix('#ffffff', accent, 0.06)
  const border = mix('#ececef', accent, 0.14)
  const midground = seed.colors.midground ?? accent

  return {
    background: '#ffffff',
    foreground: '#161616',
    card: '#ffffff',
    cardForeground: '#161616',
    muted: softer,
    mutedForeground: mix('#6b6b70', accent, 0.16),
    popover: '#ffffff',
    popoverForeground: '#161616',
    primary: accent,
    primaryForeground: readableOn(accent),
    secondary: soft,
    secondaryForeground: mix('#2a2a2a', accent, 0.34),
    accent: soft,
    accentForeground: mix('#2a2a2a', accent, 0.34),
    border,
    input: mix('#e2e2e6', accent, 0.18),
    ring: accent,
    midground,
    midgroundForeground: readableOn(midground),
    destructive: '#b94a3a',
    destructiveForeground: '#ffffff',
    sidebarBackground: mix('#fafafa', accent, 0.05),
    sidebarBorder: border,
    userBubble: soft,
    userBubbleBorder: border
  }
}

/** Returns the seed palette for a given skin + mode (no overrides applied). */
export function getBaseColors(skinName: string, mode: 'light' | 'dark'): DesktopThemeColors {
  const seed = BUILTIN_THEMES[skinName] ?? nousTheme

  if (mode === 'dark') {
    return seed.darkColors ?? seed.colors
  }

  return seed.darkColors ? seed.colors : synthLightColors(seed)
}

function deriveTheme(skinName: string, mode: 'light' | 'dark'): DesktopTheme {
  const seed = BUILTIN_THEMES[skinName] ?? nousTheme

  return {
    ...seed,
    name: `${skinName}-${mode}`,
    label: `${seed.label} ${mode === 'light' ? 'Light' : 'Dark'}`,
    description: `${seed.label} ${mode} palette`,
    colors: getBaseColors(skinName, mode)
  }
}

/**
 * Some palettes intentionally keep a bright background even when
 * `mode === 'dark'`, so we shouldn't apply the `.dark` class. Decide from
 * the actual background luminance.
 */
function renderedModeFor(colors: DesktopThemeColors, mode: 'light' | 'dark'): 'light' | 'dark' {
  const rgb = hexToRgb(colors.background)

  if (!rgb) {
    return mode
  }

  const [r, g, b] = rgb.map(v => v / 255)

  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.5 ? 'light' : 'dark'
}

// ─── CSS application ────────────────────────────────────────────────────────

// Per-mode mix knobs. Light/dark fallbacks live in styles.css `:root` /
// `:root.dark`; setting them inline keeps active-skin overrides surviving
// the boot-time paint.
const mixesFor = (isDark: boolean): Record<string, string> => ({
  '--theme-mix-chrome': isDark ? '74%' : '92%',
  '--theme-mix-sidebar': '100%',
  '--theme-mix-card': isDark ? '38%' : '22%',
  '--theme-mix-elevated': isDark ? '46%' : '28%',
  '--theme-mix-bubble': isDark ? '46%' : '0%'
})

function applyTheme(theme: DesktopTheme, mode: 'light' | 'dark', requestedMode: ThemeMode = mode) {
  if (typeof document === 'undefined') {
    return
  }

  const root = document.documentElement
  const c = theme.colors
  const typo = { ...DEFAULT_TYPOGRAPHY, ...nousTheme.typography, ...theme.typography }
  const rendered = requestedMode === 'system' ? renderedModeFor(c, mode) : mode
  const isDark = rendered === 'dark'
  const midground = c.midground ?? c.ring
  const skinName = theme.name.endsWith(`-${mode}`) ? theme.name.slice(0, -mode.length - 1) : theme.name

  root.style.setProperty('color-scheme', rendered)
  root.dataset.theme = rendered
  root.dataset.hermesTheme = skinName
  root.dataset.hermesMode = mode
  root.dataset.hermesRequestedMode = requestedMode
  root.classList.toggle('dark', isDark)

  const surfaceSecondary = cssMix(c.card, c.foreground, isDark ? 0.11 : 0.07)
  const surfaceTertiary = cssMix(c.card, c.foreground, isDark ? 0.16 : 0.11)
  const backgroundSecondary = cssMix(c.background, c.foreground, isDark ? 0.08 : 0.05)
  const backgroundTertiary = cssMix(c.background, c.foreground, isDark ? 0.13 : 0.08)
  const defaultFill = cssMix(c.background, c.foreground, isDark ? 0.16 : 0.06)
  const defaultHover = cssMix(defaultFill, c.foreground, isDark ? 0.09 : 0.06)
  const accentSoft = cssMix(c.background, c.primary, isDark ? 0.28 : 0.14)
  const accentSoftHover = cssMix(accentSoft, c.primary, isDark ? 0.2 : 0.14)
  const dangerSoft = cssMix(c.background, c.destructive, isDark ? 0.22 : 0.12)
  const warning = isDark ? '#f5c451' : '#d6a233'
  const warningSoft = cssMix(c.background, warning, isDark ? 0.18 : 0.1)
  const success = isDark ? '#4ade80' : '#15803d'
  const successSoft = cssMix(c.background, success, isDark ? 0.18 : 0.1)
  const fieldBackground = isDark ? surfaceSecondary : cssMix(c.background, c.foreground, 0.025)
  const heroPalette: Record<string, string> = {
    '--background': c.background,
    '--background-secondary': backgroundSecondary,
    '--background-tertiary': backgroundTertiary,
    '--background-inverse': c.foreground,
    '--foreground': c.foreground,
    '--surface': c.card,
    '--surface-foreground': c.cardForeground,
    '--surface-secondary': surfaceSecondary,
    '--surface-tertiary': surfaceTertiary,
    '--overlay': c.popover,
    '--overlay-foreground': c.popoverForeground,
    '--muted': c.mutedForeground,
    '--default': defaultFill,
    '--default-foreground': c.secondaryForeground,
    '--default-hover': defaultHover,
    '--default-soft': cssMix(c.background, c.foreground, isDark ? 0.18 : 0.1),
    '--default-soft-foreground': c.foreground,
    '--default-soft-hover': cssMix(c.background, c.foreground, isDark ? 0.24 : 0.14),
    '--accent': c.primary,
    '--accent-foreground': c.primaryForeground,
    '--accent-hover': cssMix(c.primary, c.primaryForeground, 0.12),
    '--accent-soft': accentSoft,
    '--accent-soft-foreground': cssMix(c.foreground, c.primary, isDark ? 0.1 : 0.2),
    '--accent-soft-hover': accentSoftHover,
    '--success': success,
    '--success-foreground': readableOn(success),
    '--success-hover': cssMix(success, readableOn(success), 0.12),
    '--success-soft': successSoft,
    '--success-soft-foreground': success,
    '--success-soft-hover': cssMix(successSoft, success, 0.12),
    '--warning': warning,
    '--warning-foreground': readableOn(warning),
    '--warning-hover': cssMix(warning, readableOn(warning), 0.12),
    '--warning-soft': warningSoft,
    '--warning-soft-foreground': warning,
    '--warning-soft-hover': cssMix(warningSoft, warning, 0.12),
    '--danger': c.destructive,
    '--danger-foreground': c.destructiveForeground,
    '--danger-hover': cssMix(c.destructive, c.destructiveForeground, 0.12),
    '--danger-soft': dangerSoft,
    '--danger-soft-foreground': c.destructive,
    '--danger-soft-hover': cssMix(dangerSoft, c.destructive, 0.12),
    '--field-background': fieldBackground,
    '--field-foreground': c.foreground,
    '--field-placeholder': c.mutedForeground,
    '--field-border': cssMix(c.input, c.foreground, isDark ? 0.18 : 0.16),
    '--field-hover': cssMix(fieldBackground, c.foreground, isDark ? 0.05 : 0.03),
    '--field-focus': c.card,
    '--field-border-hover': cssMix(c.input, c.foreground, isDark ? 0.24 : 0.18),
    '--field-border-focus': c.ring,
    '--segment': surfaceSecondary,
    '--segment-foreground': c.foreground,
    '--border': c.border,
    '--separator': c.sidebarBorder ?? c.border,
    '--focus': c.ring,
    '--link': c.primary,
    '--backdrop': isDark ? 'rgba(0, 0, 0, 0.64)' : 'rgba(10, 12, 16, 0.34)',
    '--surface-hover': cssMix(c.card, c.foreground, isDark ? 0.08 : 0.06),
    '--surface-shadow': isDark
      ? '0 0 0 0.0625rem color-mix(in srgb, var(--foreground) 8%, transparent)'
      : '0 0 0 0.0625rem color-mix(in srgb, var(--foreground) 6%, transparent), 0 0.75rem 2rem color-mix(in srgb, #000 8%, transparent)',
    '--overlay-shadow': isDark
      ? '0 0 0 0.0625rem color-mix(in srgb, var(--foreground) 10%, transparent), 0 1rem 2.5rem color-mix(in srgb, #000 36%, transparent)'
      : '0 0 0 0.0625rem color-mix(in srgb, var(--foreground) 7%, transparent), 0 1rem 2.5rem color-mix(in srgb, #000 12%, transparent)',
    '--field-shadow': isDark
      ? '0 0 0 0.0625rem color-mix(in srgb, var(--foreground) 7%, transparent)'
      : '0 0 0 0.0625rem color-mix(in srgb, var(--foreground) 5%, transparent), 0 0.25rem 0.75rem color-mix(in srgb, #000 6%, transparent)',
    '--radius': '0.8rem',
    '--field-radius': '1rem'
  }

  // Brand seeds feed every glass + shadcn token via `color-mix()` in styles.css.
  const seeds: Record<string, string> = {
    '--theme-foreground': c.foreground,
    '--theme-primary': c.primary,
    '--theme-secondary': c.secondary,
    '--theme-accent-soft': c.accent,
    '--theme-midground': midground,
    '--theme-warm': c.primary,
    '--theme-background-seed': c.background,
    '--theme-sidebar-seed': c.sidebarBackground ?? c.background,
    '--theme-card-seed': c.card,
    '--theme-elevated-seed': c.popover,
    '--theme-bubble-seed': c.userBubble ?? c.popover
  }

  // shadcn/Tailwind tokens that aren't derived from the seed chain.
  const palette: Record<string, string> = {
    '--dt-primary-foreground': c.primaryForeground,
    '--dt-secondary-foreground': c.secondaryForeground,
    '--dt-accent-foreground': c.accentForeground,
    '--dt-border': c.border,
    '--dt-input': c.input,
    '--dt-ring': c.ring,
    '--dt-muted': c.muted,
    '--dt-midground-foreground': c.midgroundForeground ?? readableOn(midground),
    '--dt-composer-ring': c.composerRing ?? midground,
    '--dt-destructive': c.destructive,
    '--dt-destructive-foreground': c.destructiveForeground,
    '--dt-sidebar-border': c.sidebarBorder ?? c.border,
    '--dt-user-bubble-border': c.userBubbleBorder ?? c.border,
    '--dt-font-sans': typo.fontSans,
    '--dt-font-mono': typo.fontMono,
    '--noise-opacity-mul': isDark ? 'calc(0.04 / 0.21)' : 'calc(0.34 / 0.21)'
  }

  for (const [k, v] of Object.entries({ ...heroPalette, ...seeds, ...mixesFor(isDark), ...palette })) {
    root.style.setProperty(k, v)
  }

  window.hermesDesktop?.setTitleBarTheme?.({
    background: c.background,
    foreground: c.foreground
  })

  if (typo.fontUrl && !INJECTED_FONT_URLS.has(typo.fontUrl)) {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = typo.fontUrl
    link.dataset.hermesThemeFont = 'true'
    document.head.appendChild(link)
    INJECTED_FONT_URLS.add(typo.fontUrl)
  }
}

// Boot-time paint to avoid a flash before <ThemeProvider> mounts.
if (typeof window !== 'undefined') {
  const skin = normalizeSkin(window.localStorage.getItem(SKIN_KEY))
  const mode = (window.localStorage.getItem(MODE_KEY) as ThemeMode) ?? 'light'
  const resolved = resolveMode(mode)
  applyTheme(deriveTheme(skin, resolved), resolved, mode)
}

// ─── Context ────────────────────────────────────────────────────────────────

interface ThemeContextValue {
  theme: DesktopTheme
  themeName: string
  mode: ThemeMode
  resolvedMode: 'light' | 'dark'
  availableThemes: Array<{ name: string; label: string; description: string }>
  setTheme: (name: string) => void
  setMode: (mode: ThemeMode) => void
}

const SKIN_LIST = BUILTIN_THEME_LIST.map(({ name, label, description }) => ({ name, label, description }))

const ThemeContext = createContext<ThemeContextValue>({
  theme: nousTheme,
  themeName: DEFAULT_SKIN_NAME,
  mode: 'light',
  resolvedMode: 'light',
  availableThemes: SKIN_LIST,
  setTheme: () => {},
  setMode: () => {}
})

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeName, setThemeNameState] = useState(() =>
    typeof window === 'undefined' ? DEFAULT_SKIN_NAME : normalizeSkin(window.localStorage.getItem(SKIN_KEY))
  )

  const [mode, setModeState] = useState<ThemeMode>(() =>
    typeof window === 'undefined' ? 'light' : ((window.localStorage.getItem(MODE_KEY) as ThemeMode) ?? 'light')
  )

  const systemDark = useMediaQuery('(prefers-color-scheme: dark)')
  const resolvedMode = resolveMode(mode, systemDark)
  const activeTheme = useMemo(() => deriveTheme(themeName, resolvedMode), [themeName, resolvedMode])

  useEffect(() => applyTheme(activeTheme, resolvedMode, mode), [activeTheme, mode, resolvedMode])

  const setTheme = useCallback((name: string) => {
    const next = normalizeSkin(name)
    setThemeNameState(next)
    window.localStorage.setItem(SKIN_KEY, next)
  }, [])

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next)
    window.localStorage.setItem(MODE_KEY, next)
  }, [])

  // Shift+X toggles light/dark anywhere outside an editable field.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const t = event.target as HTMLElement | null

      const editing =
        t?.isContentEditable ||
        t instanceof HTMLInputElement ||
        t instanceof HTMLTextAreaElement ||
        t instanceof HTMLSelectElement

      if (editing || event.repeat || event.altKey || event.ctrlKey || event.metaKey) {
        return
      }

      if (event.shiftKey && event.code === 'KeyX') {
        setMode(resolvedMode === 'dark' ? 'light' : 'dark')
      }
    }

    window.addEventListener('keydown', onKeyDown)

    return () => window.removeEventListener('keydown', onKeyDown)
  }, [resolvedMode, setMode])

  const value = useMemo<ThemeContextValue>(
    () => ({ theme: activeTheme, themeName, mode, resolvedMode, availableThemes: SKIN_LIST, setTheme, setMode }),
    [activeTheme, themeName, mode, resolvedMode, setTheme, setMode]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export const useTheme = (): ThemeContextValue => useContext(ThemeContext)

/** Sync the desktop skin with the active Hermes backend theme on connect. */
export function useSyncThemeFromBackend(backendThemeName: string | undefined, setTheme: (name: string) => void) {
  useEffect(() => {
    if (backendThemeName && BUILTIN_THEMES[backendThemeName]) {
      setTheme(backendThemeName)
    }
  }, [backendThemeName, setTheme])
}
