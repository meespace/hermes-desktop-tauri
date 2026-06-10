import { useStore } from '@nanostores/react'

import { LanguageSwitcher } from '@/components/language-switcher'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { useI18n } from '@/i18n'
import { triggerHaptic } from '@/lib/haptics'
import { Check, Palette } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { $toolViewMode, setToolViewMode } from '@/store/tool-view'
import { useTheme } from '@/themes/context'
import { BUILTIN_THEMES } from '@/themes/presets'

import { MODE_OPTIONS } from './constants'
import { Pill, SectionHeading, SettingsContent } from './primitives'

const APPEARANCE_SECTION_CLASS =
  'rounded-[0.74rem] border border-[color-mix(in_srgb,var(--workbench-divider)_94%,transparent)] bg-[var(--workbench-panel-bg)] px-4 py-3.5 shadow-none'
const APPEARANCE_OPTION_CLASS =
  'group rounded-[0.66rem] border border-[color-mix(in_srgb,var(--workbench-divider)_92%,transparent)] bg-[var(--workbench-panel-bg)] p-2.5 text-left shadow-none transition-[background-color,border-color,color]'
const APPEARANCE_OPTION_ACTIVE_CLASS =
  'border-[color-mix(in_srgb,var(--accent)_16%,transparent)] bg-[var(--workbench-active)]'
const APPEARANCE_OPTION_IDLE_CLASS = 'hover:border-[var(--workbench-divider)] hover:bg-[var(--workbench-hover)]'

function ThemePreview({ name }: { name: string }) {
  const t = BUILTIN_THEMES[name]

  if (!t) {
    return null
  }

  const c = t.colors

  return (
    <div
      className="h-20 overflow-hidden rounded-[0.58rem] border shadow-none"
      style={{ backgroundColor: c.background, borderColor: c.border }}
    >
      <div className="flex h-full">
        <div
          className="w-12 border-r"
          style={{
            backgroundColor: c.sidebarBackground ?? c.muted,
            borderColor: c.sidebarBorder ?? c.border
          }}
        />
        <div className="flex flex-1 flex-col gap-2 p-3">
          <div className="h-2.5 w-16 rounded-[0.25rem]" style={{ backgroundColor: c.foreground }} />
          <div className="h-2 w-24 rounded-[0.2rem]" style={{ backgroundColor: c.mutedForeground }} />
          <div className="mt-auto flex justify-end">
            <div
              className="h-5 w-16 rounded-[0.3rem] border"
              style={{
                backgroundColor: c.userBubble ?? c.muted,
                borderColor: c.userBubbleBorder ?? c.border
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export function AppearanceSettings() {
  const { t, isSavingLocale } = useI18n()
  const { themeName, mode, availableThemes, setTheme, setMode } = useTheme()
  const toolViewMode = useStore($toolViewMode)
  const activeTheme = availableThemes.find(t => t.name === themeName)
  const a = t.settings.appearance
  const modeOptions = MODE_OPTIONS.map(({ id, icon }) => ({ icon, id, label: t.settings.modeOptions[id].label }))
  const toolOptions = [
    { id: 'product', label: a.product },
    { id: 'technical', label: a.technical }
  ] as const

  return (
    <SettingsContent>
      <div className="space-y-4">
        <div>
          <SectionHeading icon={Palette} title={a.title} />
          <p className="max-w-2xl text-[length:var(--conversation-caption-font-size)] leading-(--conversation-caption-line-height) text-[var(--muted)]">
            {a.intro}
          </p>
        </div>

        <section className={APPEARANCE_SECTION_CLASS}>
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium">{t.language.label}</div>
              <div className="mt-1 text-xs text-[var(--muted)]">{isSavingLocale ? t.language.saving : t.language.description}</div>
            </div>
            <LanguageSwitcher />
          </div>
          <div className="mt-2 flex justify-end">
            <SegmentedControl
              onChange={id => {
                triggerHaptic('crisp')
                setMode(id)
              }}
              options={modeOptions}
              value={mode}
            />
          </div>
        </section>

        <section className={APPEARANCE_SECTION_CLASS}>
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium">{a.toolViewTitle}</div>
              <div className="mt-1 text-xs text-[var(--muted)]">{a.toolViewDesc}</div>
            </div>
            <Pill>{toolViewMode === 'technical' ? 'Technical' : 'Product'}</Pill>
          </div>
          <div className="mt-2 flex justify-end">
            <SegmentedControl
              onChange={id => {
                triggerHaptic('selection')
                setToolViewMode(id)
              }}
              options={toolOptions}
              value={toolViewMode}
            />
          </div>
        </section>

        <section className={APPEARANCE_SECTION_CLASS}>
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium">{a.themeTitle}</div>
              <div className="mt-1 text-xs text-[var(--muted)]">{a.themeDesc}</div>
            </div>
            {activeTheme && <Pill>{activeTheme.label}</Pill>}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {availableThemes.map(theme => {
              const active = themeName === theme.name

              return (
                <button
                  className={cn(
                    APPEARANCE_OPTION_CLASS,
                    active ? APPEARANCE_OPTION_ACTIVE_CLASS : APPEARANCE_OPTION_IDLE_CLASS
                  )}
                  key={theme.name}
                  onClick={() => {
                    triggerHaptic('crisp')
                    setTheme(theme.name)
                  }}
                  type="button"
                >
                  <ThemePreview name={theme.name} />
                  <div className="mt-3 flex items-start justify-between gap-3 px-1">
                    <div className="min-w-0">
                      <div className="truncate text-[length:var(--conversation-text-font-size)] font-medium">
                        {theme.label}
                      </div>
                      <div className="mt-0.5 line-clamp-2 text-[length:var(--conversation-caption-font-size)] leading-(--conversation-caption-line-height) text-[var(--muted)]">
                        {theme.description}
                      </div>
                    </div>
                    {active && (
                      <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-[0.3rem] bg-[var(--accent)] text-[var(--accent-foreground)]">
                        <Check className="size-3.5" />
                      </span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </section>
      </div>
    </SettingsContent>
  )
}
