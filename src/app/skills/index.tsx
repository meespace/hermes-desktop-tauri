import type * as React from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { PageLoader } from '@/components/page-loader'
import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import { Switch } from '@/components/ui/switch'
import { TextTab, TextTabMeta } from '@/components/ui/text-tab'
import { getSkills, getToolsets, toggleSkill, toggleToolset } from '@/hermes'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/utils'
import { notify, notifyError } from '@/store/notifications'
import type { SkillInfo, ToolsetInfo } from '@/types/hermes'

import { useRouteEnumParam } from '../hooks/use-route-enum-param'
import { PageSearchShell } from '../page-search-shell'
import { asText, includesQuery, prettyName, toolNames } from '../settings/helpers'
import { ToolsetConfigPanel } from '../settings/toolset-config-panel'
import type { SetStatusbarItemGroup } from '../shell/statusbar-controls'

const SKILLS_MODES = ['skills', 'toolsets'] as const
type SkillsMode = (typeof SKILLS_MODES)[number]

function categoryFor(skill: SkillInfo): string {
  return asText(skill.category) || 'general'
}

function filteredSkills(skills: SkillInfo[], query: string, category: string | null): SkillInfo[] {
  const q = query.trim().toLowerCase()

  return skills
    .filter(skill => {
      if (category && categoryFor(skill) !== category) {
        return false
      }

      if (!q) {
        return true
      }

      return includesQuery(skill.name, q) || includesQuery(skill.description, q) || includesQuery(skill.category, q)
    })
    .sort((a, b) => asText(a.name).localeCompare(asText(b.name)))
}

function filteredToolsets(toolsets: ToolsetInfo[], query: string): ToolsetInfo[] {
  const q = query.trim().toLowerCase()

  return toolsets
    .filter(toolset => {
      if (!q) {
        return true
      }

      return (
        includesQuery(toolset.name, q) ||
        includesQuery(toolset.label, q) ||
        includesQuery(toolset.description, q) ||
        toolNames(toolset).some(name => includesQuery(name, q))
      )
    })
    .sort((a, b) => asText(a.label || a.name).localeCompare(asText(b.label || b.name)))
}

interface SkillsViewProps extends React.ComponentProps<'section'> {
  setStatusbarItemGroup?: SetStatusbarItemGroup
}

export function SkillsView({ setStatusbarItemGroup: _setStatusbarItemGroup, ...props }: SkillsViewProps) {
  const { t } = useI18n()
  const [mode, setMode] = useRouteEnumParam('tab', SKILLS_MODES, 'skills')

  const [query, setQuery] = useState('')
  const [skills, setSkills] = useState<SkillInfo[] | null>(null)
  const [toolsets, setToolsets] = useState<ToolsetInfo[] | null>(null)
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [savingSkill, setSavingSkill] = useState<string | null>(null)
  const [savingToolset, setSavingToolset] = useState<string | null>(null)
  const [expandedToolset, setExpandedToolset] = useState<string | null>(null)

  const refreshCapabilities = useCallback(async () => {
    setRefreshing(true)

    try {
      const [nextSkills, nextToolsets] = await Promise.all([getSkills(), getToolsets()])
      setSkills(nextSkills)
      setToolsets(nextToolsets)
    } catch (err) {
      notifyError(err, t.skills.skillsFailedToLoad)
    } finally {
      setRefreshing(false)
    }
  }, [t.skills.skillsFailedToLoad])

  const refreshToolsets = useCallback(() => {
    getToolsets()
      .then(setToolsets)
      .catch(err => notifyError(err, t.skills.toolsetsFailedToRefresh))
  }, [t.skills.toolsetsFailedToRefresh])

  useEffect(() => {
    void refreshCapabilities()
  }, [refreshCapabilities])

  const categories = useMemo(() => {
    if (!skills) {
      return []
    }

    const counts = new Map<string, number>()

    for (const skill of skills) {
      const key = categoryFor(skill)
      counts.set(key, (counts.get(key) || 0) + 1)
    }

    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([key, count]) => ({ key, count }))
  }, [skills])

  const categoryRank = useMemo(() => new Map(categories.map((category, index) => [category.key, index])), [categories])

  const visibleSkills = useMemo(
    () => (skills ? filteredSkills(skills, query, mode === 'skills' ? activeCategory : null) : []),
    [activeCategory, mode, query, skills]
  )

  const visibleToolsets = useMemo(() => (toolsets ? filteredToolsets(toolsets, query) : []), [query, toolsets])

  const skillGroups = useMemo(() => {
    const groups = new Map<string, SkillInfo[]>()

    for (const skill of visibleSkills) {
      const key = categoryFor(skill)
      groups.set(key, [...(groups.get(key) || []), skill])
    }

    return Array.from(groups.entries()).sort(
      ([a], [b]) => (categoryRank.get(a) ?? Number.MAX_SAFE_INTEGER) - (categoryRank.get(b) ?? Number.MAX_SAFE_INTEGER)
    )
  }, [categoryRank, visibleSkills])

  const totalSkills = skills?.length || 0
  const enabledSkills = skills?.filter(skill => skill.enabled).length || 0
  const enabledToolsets = toolsets?.filter(toolset => toolset.enabled).length || 0

  async function handleToggleSkill(skill: SkillInfo, enabled: boolean) {
    setSavingSkill(skill.name)

    try {
      await toggleSkill(skill.name, enabled)
      setSkills(current => current?.map(row => (row.name === skill.name ? { ...row, enabled } : row)) ?? current)
      notify({
        kind: 'success',
        title: enabled ? t.skills.skillEnabled : t.skills.skillDisabled,
        message: t.skills.appliesToNewSessions(skill.name)
      })
    } catch (err) {
      notifyError(err, t.skills.failedToUpdate(skill.name))
    } finally {
      setSavingSkill(null)
    }
  }

  async function handleToggleToolset(toolset: ToolsetInfo, enabled: boolean) {
    setSavingToolset(toolset.name)

    try {
      await toggleToolset(toolset.name, enabled)
      setToolsets(current =>
        current?.map(row => (row.name === toolset.name ? { ...row, enabled, available: enabled } : row)) ?? current
      )
      notify({
        kind: 'success',
        title: enabled ? t.skills.toolsetEnabled : t.skills.toolsetDisabled,
        message: t.skills.appliesToNewSessions(asText(toolset.label || toolset.name))
      })
    } catch (err) {
      notifyError(err, t.skills.failedToUpdate(asText(toolset.label || toolset.name)))
    } finally {
      setSavingToolset(null)
    }
  }

  return (
    <PageSearchShell
      {...props}
      headerTitle={t.sidebar.skills}
      showSidebarRestoreButton
      filters={
        <div className="grid gap-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <TextTab active={mode === 'skills'} className="min-w-[4.75rem] justify-center" onClick={() => setMode('skills')}>
              {t.skills.skills}
            </TextTab>
            <TextTab active={mode === 'toolsets'} className="min-w-[4.75rem] justify-center" onClick={() => setMode('toolsets')}>
              {t.skills.toolsets}
            </TextTab>
          </div>
          {mode === 'skills' && categories.length > 0 && (
            <div className="rounded-[0.95rem] border border-[var(--workbench-divider)] bg-[color-mix(in_srgb,var(--surface)_74%,transparent)] px-2 py-2">
              <div className="mb-1.5 flex items-center justify-between gap-2 px-1 text-[0.62rem] font-medium tracking-[0.08em] text-[color-mix(in_srgb,var(--foreground)_56%,transparent)]">
                <span className="uppercase">{t.skills.skills}</span>
                <span>{enabledSkills}/{totalSkills}</span>
              </div>
              <div className="px-0.5 pb-0.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <TextTab active={activeCategory === null} onClick={() => setActiveCategory(null)}>
                    {t.skills.all} <TextTabMeta>{totalSkills}</TextTabMeta>
                  </TextTab>
                  {categories.map(category => (
                    <TextTab
                      active={activeCategory === category.key}
                      key={category.key}
                      onClick={() => setActiveCategory(activeCategory === category.key ? null : category.key)}
                    >
                      {prettyName(category.key)} <TextTabMeta>{category.count}</TextTabMeta>
                    </TextTab>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      }
      onSearchChange={setQuery}
      searchPlaceholder={mode === 'skills' ? t.skills.searchSkills : t.skills.searchToolsets}
      searchTrailingAction={
        <Button
          aria-label={refreshing ? t.skills.refreshingSkills : t.skills.refreshSkills}
          className="text-[var(--muted)] hover:bg-transparent hover:text-[var(--foreground)]"
          disabled={refreshing}
          onClick={() => void refreshCapabilities()}
          size="icon-xs"
          title={refreshing ? t.skills.refreshingSkills : t.skills.refreshSkills}
          type="button"
          variant="ghost"
        >
          <Codicon name="refresh" size="0.875rem" spinning={refreshing} />
        </Button>
      }
      searchValue={query}
    >
      {!skills || !toolsets ? (
        <PageLoader label={t.skills.loadingCapabilities} />
      ) : mode === 'skills' ? (
        <div className="scrollbar-dt h-full overflow-y-auto px-3 py-3.5">
          {visibleSkills.length === 0 ? (
            <EmptyState description={t.skills.noSkillsFoundDescription} title={t.skills.noSkillsFound} />
          ) : (
            <div className="mx-auto w-full max-w-[70rem] space-y-3">
              <div className="rounded-[0.95rem] border border-[var(--workbench-divider)] bg-[var(--workbench-panel-bg)] px-3.5 py-2.5 text-[0.7rem] text-[color-mix(in_srgb,var(--foreground)_62%,transparent)] shadow-[var(--field-shadow)]">
                {enabledSkills}/{totalSkills} {t.skills.skills}
              </div>
              {skillGroups.map(([category, list]) => (
                <section className="space-y-1.5" key={category}>
                  <div className="flex items-center gap-2 px-1">
                    <div className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-[color-mix(in_srgb,var(--foreground)_58%,transparent)]">
                      {prettyName(category)}
                    </div>
                    <TextTabMeta>{list.length}</TextTabMeta>
                    <div className="h-px flex-1 bg-[var(--workbench-divider)]" />
                  </div>
                  <div className="overflow-hidden rounded-[0.95rem] border border-[color-mix(in_srgb,var(--workbench-divider)_92%,transparent)] bg-[var(--workbench-panel-bg)] shadow-[0_0_0_1px_color-mix(in_srgb,var(--foreground)_2%,transparent)]">
                    {list.map(skill => (
                      <div
                        className="grid gap-3 border-b border-[color-mix(in_srgb,var(--workbench-divider)_86%,transparent)] px-3 py-3 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                        key={skill.name}
                      >
                        <div className="min-w-0">
                          <div className="truncate text-[0.82rem] font-semibold leading-5 tracking-[-0.015em] text-[var(--foreground)]">
                            {skill.name}
                          </div>
                          <p className="mt-1 max-w-[72ch] line-clamp-2 text-[0.69rem] leading-4.5 text-[color-mix(in_srgb,var(--foreground)_62%,transparent)]">
                            {asText(skill.description) || t.skills.noDescription}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center justify-end">
                          <Switch
                            checked={skill.enabled}
                            disabled={savingSkill === skill.name}
                            onCheckedChange={checked => void handleToggleSkill(skill, checked)}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="scrollbar-dt h-full overflow-y-auto px-3 py-3.5">
          {visibleToolsets.length === 0 ? (
            <EmptyState description={t.skills.noToolsetsFoundDescription} title={t.skills.noToolsetsFound} />
          ) : (
            <div className="mx-auto w-full max-w-[70rem] space-y-3">
              <div className="rounded-[0.95rem] border border-[var(--workbench-divider)] bg-[var(--workbench-panel-bg)] px-3.5 py-2.5 text-[0.7rem] text-[color-mix(in_srgb,var(--foreground)_62%,transparent)] shadow-[var(--field-shadow)]">
                {t.skills.enabledSummary(enabledToolsets, toolsets.length)}
              </div>
              <div className="overflow-hidden rounded-[0.95rem] border border-[color-mix(in_srgb,var(--workbench-divider)_92%,transparent)] bg-[var(--workbench-panel-bg)] shadow-[0_0_0_1px_color-mix(in_srgb,var(--foreground)_2%,transparent)]">
                {visibleToolsets.map(toolset => {
                  const tools = toolNames(toolset)
                  const label = asText(toolset.label || toolset.name)
                  const expanded = expandedToolset === toolset.name

                  return (
                    <div
                      className="border-b border-[color-mix(in_srgb,var(--workbench-divider)_86%,transparent)] px-3 py-3 last:border-b-0"
                      key={toolset.name}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="truncate text-[0.84rem] font-semibold tracking-[-0.015em] text-[var(--foreground)]">
                          {label}
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                          <button
                            aria-expanded={expanded}
                            aria-label={t.skills.configure(label)}
                            className="cursor-pointer rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                            onClick={() => setExpandedToolset(current => (current === toolset.name ? null : toolset.name))}
                            type="button"
                          >
                            <StatusPill active={toolset.configured}>
                              {toolset.configured ? t.skills.configured : t.skills.needsKeys}
                            </StatusPill>
                          </button>
                          <Switch
                            aria-label={t.skills.toggleToolset(label)}
                            checked={toolset.enabled}
                            disabled={savingToolset === toolset.name}
                            onCheckedChange={checked => void handleToggleToolset(toolset, checked)}
                          />
                        </div>
                      </div>
                      <p className="mt-1 max-w-[72ch] line-clamp-2 text-[0.69rem] leading-4.5 text-[color-mix(in_srgb,var(--foreground)_62%,transparent)]">
                        {asText(toolset.description) || t.skills.noDescription}
                      </p>
                      {tools.length > 0 && (
                        <div className="mt-2.5 flex flex-wrap gap-1.5">
                          {tools.map(name => (
                            <span
                              className="rounded-full border border-[var(--workbench-divider)] bg-[var(--surface-secondary)] px-2 py-0.5 font-mono text-[0.62rem] text-[color-mix(in_srgb,var(--foreground)_70%,transparent)]"
                              key={name}
                            >
                              {name}
                            </span>
                          ))}
                        </div>
                      )}
                      {expanded && <ToolsetConfigPanel onConfiguredChange={refreshToolsets} toolset={toolset.name} />}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </PageSearchShell>
  )
}

function StatusPill({ active, children }: { active: boolean; children: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[0.64rem] shadow-[var(--field-shadow)]',
        active ? 'bg-[var(--success-soft)] text-[var(--success)]' : 'bg-[var(--warning-soft)] text-[var(--warning)]'
      )}
    >
      {children}
    </span>
  )
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="grid min-h-52 place-items-center text-center">
      <div>
        <div className="text-sm font-medium">{title}</div>
        <div className="mt-1 text-xs text-[color-mix(in_srgb,var(--foreground)_62%,transparent)]">{description}</div>
      </div>
    </div>
  )
}
