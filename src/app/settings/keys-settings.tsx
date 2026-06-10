import { useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import { Input } from '@/components/ui/input'
import { useI18n, type Translations } from '@/i18n'
import { Check, Eye, EyeOff, Save, Settings2, Trash2, Zap } from '@/lib/icons'
import { cn } from '@/lib/utils'
import type { EnvVarInfo } from '@/types/hermes'

import { CONTROL_TEXT, LOCAL_ENDPOINT_ENV_KEY } from './constants'
import { filterEnv, useEnvCredentials } from './env-credentials'
import {
  prettyName,
  providerGroup,
  providerPriority,
  withoutKey
} from './helpers'
import { LoadingState, Pill, SectionHeading, SettingsContent } from './primitives'
import type { EnvRowProps, ProviderGroup, SearchProps } from './types'

interface EnvActionsProps {
  varKey: string
  info: EnvVarInfo
  saving: string | null
  onEdit: () => void
  onClear: (key: string) => void
  onReveal: (key: string) => void
  isRevealed: boolean
  showReveal?: boolean
  copy: Translations['settings']['keys']
}

function EnvActions({
  varKey,
  info,
  saving,
  onEdit,
  onClear,
  onReveal,
  isRevealed,
  showReveal = true,
  copy
}: EnvActionsProps) {
  return (
    <div className="flex shrink-0 items-center gap-1.5">
      {info.url && (
        <Button asChild size="xs" title={copy.openDocs} variant="ghost">
          <a href={info.url} rel="noreferrer" target="_blank">
            {copy.openDocs}
          </a>
        </Button>
      )}
      {info.is_set && showReveal && (
        <Button
          onClick={() => onReveal(varKey)}
          size="icon-xs"
          title={isRevealed ? copy.hideValue : copy.revealValue}
          variant="ghost"
        >
          {isRevealed ? <EyeOff /> : <Eye />}
        </Button>
      )}
      <Button onClick={onEdit} size="xs" variant="outline">
        {info.is_set ? copy.replace : copy.set}
      </Button>
      {info.is_set && (
        <Button
          disabled={saving === varKey}
          onClick={() => onClear(varKey)}
          size="icon-xs"
          title={copy.clearValue}
          variant="ghost"
        >
          <Trash2 />
        </Button>
      )}
    </div>
  )
}

function EnvVarRow({
  varKey,
  info,
  edits,
  revealed,
  saving,
  setEdits,
  onSave,
  onClear,
  onReveal,
  compact = false
}: EnvRowProps) {
  const { t } = useI18n()
  const isEditing = edits[varKey] !== undefined
  const isRevealed = revealed[varKey] !== undefined
  const value = isRevealed ? revealed[varKey] : info.redacted_value
  const startEdit = () => setEdits(c => ({ ...c, [varKey]: '' }))

  if (compact && !isEditing) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-[0.5rem] px-1 py-1.5">
        <div className="min-w-0">
          <div className="truncate font-mono text-[0.7rem] text-[var(--muted)]">{varKey}</div>
          <div className="truncate text-[0.68rem] text-[color-mix(in_srgb,var(--foreground)_58%,transparent)]">
            {info.description}
          </div>
        </div>
        <EnvActions
          info={info}
          isRevealed={isRevealed}
          onClear={onClear}
          onEdit={startEdit}
          onReveal={onReveal}
          saving={saving}
          showReveal={false}
          varKey={varKey}
          copy={t.settings.keys}
        />
      </div>
    )
  }

  return (
    <div className="grid gap-2 rounded-[0.68rem] border border-[color-mix(in_srgb,var(--workbench-divider)_94%,transparent)] bg-[var(--workbench-panel-bg)] px-3.5 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs font-medium">{varKey}</span>
            <Pill tone={info.is_set ? 'primary' : 'muted'}>
              {info.is_set && <Check className="size-3" />}
              {info.is_set ? t.settings.keys.set : t.settings.keys.notSet}
            </Pill>
          </div>
          <p className="mt-1 text-xs leading-5 text-[var(--muted)]">{info.description}</p>
        </div>
        <EnvActions
          info={info}
          isRevealed={isRevealed}
          onClear={onClear}
          onEdit={startEdit}
          onReveal={onReveal}
          saving={saving}
          varKey={varKey}
          copy={t.settings.keys}
        />
      </div>

      {!isEditing && info.is_set && (
        <div
          className={cn(
            'rounded-[0.52rem] border px-3 py-2 font-mono text-xs',
            isRevealed
              ? 'border-[var(--workbench-divider)] bg-[var(--workbench-panel-muted-bg)] text-[var(--foreground)]'
              : 'border-[color-mix(in_srgb,var(--workbench-divider)_78%,transparent)] bg-[var(--surface-secondary)] text-[var(--default-soft-foreground)]'
          )}
        >
          {value || '---'}
        </div>
      )}

      {isEditing && (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            autoFocus
            className={cn('min-w-56 flex-1 font-mono', CONTROL_TEXT)}
            onChange={e => setEdits(c => ({ ...c, [varKey]: e.target.value }))}
            placeholder={info.is_set ? t.settings.keys.replaceCurrent : t.settings.keys.enterValue}
            type={info.is_password ? 'password' : 'text'}
            value={edits[varKey]}
          />
          <Button disabled={saving === varKey || !edits[varKey]} onClick={() => onSave(varKey)} size="sm">
            <Save />
            {saving === varKey ? t.common.saving : t.common.save}
          </Button>
          <Button onClick={() => setEdits(c => withoutKey(c, varKey))} size="sm" variant="outline">
            <Codicon name="close" />
            {t.common.cancel}
          </Button>
        </div>
      )}
    </div>
  )
}

function EnvProviderGroup({
  group,
  rowProps
}: {
  group: ProviderGroup
  rowProps: Omit<EnvRowProps, 'varKey' | 'info'>
}) {
  const { t } = useI18n()
  const setCount = group.entries.filter(([, info]) => info.is_set).length
  // Default-expand providers that already have at least one key set; the
  // user is much more likely to be coming back to edit those than to start
  // configuring a fresh provider from scratch.
  const [expanded, setExpanded] = useState(setCount > 0)

  return (
    <div className="overflow-hidden rounded-[0.74rem] border border-[color-mix(in_srgb,var(--workbench-divider)_94%,transparent)] bg-[var(--workbench-panel-bg)]">
      <button
        className="flex w-full items-center justify-between gap-3 bg-transparent px-3.5 py-3 text-left transition-[background-color,border-color,color] hover:bg-[var(--workbench-hover)]"
        onClick={() => setExpanded(e => !e)}
        type="button"
      >
        <span className="flex min-w-0 items-center gap-2">
          <Zap className="size-4 shrink-0 text-[var(--muted)]" />
          <span className="truncate text-sm font-medium">
            {group.name === 'Other' ? t.settings.keys.otherProviders : group.name}
          </span>
          {setCount > 0 && <Pill tone="primary">{t.settings.keys.setMeta(setCount, group.entries.length)}</Pill>}
        </span>
        <span className="text-xs text-[var(--muted)]">{group.entries.length}</span>
      </button>
      {expanded && (
        <div className="grid gap-2 border-t border-[var(--separator)] bg-[var(--workbench-panel-muted-bg)] p-3">
          {group.entries.map(([key, info]) => (
            <EnvVarRow compact={!info.is_set} info={info} key={key} varKey={key} {...rowProps} />
          ))}
        </div>
      )}
    </div>
  )
}

export function KeysSettings({ query }: SearchProps) {
  const { t } = useI18n()
  const { rowProps, vars } = useEnvCredentials()

  const providerGroups = useMemo<ProviderGroup[]>(() => {
    if (!vars) {
      return []
    }

    const q = query.trim().toLowerCase()

    const providerEntries = Object.entries(vars).filter(([key, info]) =>
      filterEnv(
        info,
        key,
        q,
        'provider',
        key === LOCAL_ENDPOINT_ENV_KEY ? t.settings.keys.localGroup : providerGroup(key)
      )
    )

    const apiKeyEntries = providerEntries.filter(([key]) => key !== LOCAL_ENDPOINT_ENV_KEY)
    const localEntries = providerEntries.filter(([key]) => key === LOCAL_ENDPOINT_ENV_KEY)

    const groups: ProviderGroup[] = []

    if (apiKeyEntries.length > 0) {
      groups.push({
        name: t.settings.keys.apiKeyCustomGroup,
        priority: -2,
        entries: [...apiKeyEntries].sort(([a], [b]) => {
          const groupDiff = providerPriority(providerGroup(a)) - providerPriority(providerGroup(b))
          return groupDiff || a.localeCompare(b)
        }),
        hasAnySet: apiKeyEntries.some(([, info]) => info.is_set)
      })
    }

    if (localEntries.length > 0) {
      groups.push({
        name: t.settings.keys.localGroup,
        priority: -1,
        entries: [...localEntries].sort(([a], [b]) => a.localeCompare(b)),
        hasAnySet: localEntries.some(([, info]) => info.is_set)
      })
    }

    return groups
  }, [query, t.settings.keys.apiKeyCustomGroup, t.settings.keys.localGroup, vars])

  const otherGroups = useMemo(() => {
    if (!vars) {
      return []
    }

    const q = query.trim().toLowerCase()

    const labels = t.settings.keys.categories

    return ['tool', 'messaging', 'setting'].flatMap(cat => {
      const entries = Object.entries(vars)
        .filter(([key, info]) => filterEnv(info, key, q, cat))
        .sort(([a], [b]) => a.localeCompare(b))

      return entries.length === 0 ? [] : [{ category: cat, label: labels[cat] ?? prettyName(cat), entries }]
    })
  }, [query, t.settings.keys.categories, vars])

  if (!vars) {
    return <LoadingState label={t.settings.keys.loading} />
  }

  const configuredCount = providerGroups.filter(g => g.hasAnySet).length

  return (
    <SettingsContent>
      <div className="mb-7">
        <SectionHeading
          icon={Zap}
          meta={t.settings.keys.configuredMeta(configuredCount, providerGroups.length)}
          title={t.settings.keys.llmProviders}
        />
        <div className="grid gap-2.5">
          {providerGroups.map(group => (
            <EnvProviderGroup group={group} key={group.name} rowProps={rowProps} />
          ))}
        </div>
      </div>

      {otherGroups.map(group => (
        <div className="mb-7" key={group.category}>
          <SectionHeading
            icon={Settings2}
            meta={t.settings.keys.setMeta(group.entries.filter(([, i]) => i.is_set).length, group.entries.length)}
            title={group.label}
          />
          <div className="grid gap-2.5">
            {group.entries.map(([key, info]) => (
              <EnvVarRow info={info} key={key} varKey={key} {...rowProps} />
            ))}
          </div>
        </div>
      ))}
    </SettingsContent>
  )
}
