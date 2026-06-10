import { useEffect, useState } from 'react'

import { deleteEnvVar, getEnvVars, revealEnvVar, setEnvVar } from '@/hermes'
import { type IconComponent } from '@/lib/icons'
import { notify, notifyError } from '@/store/notifications'
import type { EnvVarInfo } from '@/types/hermes'

import { asText, includesQuery, redactedValue, withoutKey } from './helpers'
import { Pill } from './primitives'
import type { EnvRowProps } from './types'

export function filterEnv(info: EnvVarInfo, key: string, q: string, cat: string, extra?: string): boolean {
  if (asText(info.category) !== cat) {
    return false
  }

  if (!q) {
    return true
  }

  return (
    key.toLowerCase().includes(q) ||
    includesQuery(info.description, q) ||
    Boolean(extra && extra.toLowerCase().includes(q))
  )
}

export function SettingsCategoryHeading({ count, icon: Icon, title }: CategoryHeadingProps) {
  return (
    <div className="mb-3 flex items-center gap-2 text-[0.86rem] font-medium">
      <Icon className="size-4 text-[var(--muted)]" />
      <span>{title}</span>
      {count ? <Pill>{count}</Pill> : null}
    </div>
  )
}

export function useEnvCredentials(): UseEnvCredentials {
  const [vars, setVars] = useState<Record<string, EnvVarInfo> | null>(null)
  const [edits, setEdits] = useState<Record<string, string>>({})
  const [revealed, setRevealed] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<string | null>(null)

  useEffect(() => {
    try {
      window.localStorage.removeItem('desktop.settings.keys.show_advanced')
    } catch {
      // Best effort cleanup for an older UI flag.
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    void (async () => {
      try {
        const next = await getEnvVars()

        if (!cancelled) {
          setVars(next)
        }
      } catch (err) {
        notifyError(err, 'API keys failed to load')
      }
    })()

    return () => void (cancelled = true)
  }, [])

  function patchVar(key: string, patch: Partial<Pick<EnvVarInfo, 'is_set' | 'redacted_value'>>) {
    setVars(current => (current ? { ...current, [key]: { ...current[key], ...patch } } : current))
  }

  function clearLocalState(key: string) {
    setEdits(current => withoutKey(current, key))
    setRevealed(current => withoutKey(current, key))
  }

  async function handleSave(key: string) {
    const value = edits[key]

    if (!value) {
      return
    }

    setSaving(key)

    try {
      await setEnvVar(key, value)
      patchVar(key, { is_set: true, redacted_value: redactedValue(value) })
      clearLocalState(key)
      notify({ kind: 'success', title: 'Credential saved', message: `${key} updated.` })
    } catch (err) {
      notifyError(err, `Failed to save ${key}`)
    } finally {
      setSaving(null)
    }
  }

  async function saveValue(key: string, value: string): Promise<{ message?: string; ok: boolean }> {
    const trimmed = value.trim()

    if (!trimmed) {
      return { message: 'Enter a value first.', ok: false }
    }

    setSaving(key)

    try {
      await setEnvVar(key, trimmed)
      patchVar(key, { is_set: true, redacted_value: redactedValue(trimmed) })
      clearLocalState(key)
      notify({ kind: 'success', title: 'Credential saved', message: `${key} updated.` })

      return { ok: true }
    } catch (err) {
      notifyError(err, `Failed to save ${key}`)

      return { message: err instanceof Error ? err.message : 'Could not save credential.', ok: false }
    } finally {
      setSaving(null)
    }
  }

  async function handleClear(key: string) {
    if (!window.confirm(`Remove ${key} from .env?`)) {
      return
    }

    setSaving(key)

    try {
      await deleteEnvVar(key)
      patchVar(key, { is_set: false, redacted_value: null })
      clearLocalState(key)
      notify({ kind: 'success', title: 'Credential removed', message: `${key} removed.` })
    } catch (err) {
      notifyError(err, `Failed to remove ${key}`)
    } finally {
      setSaving(null)
    }
  }

  async function handleReveal(key: string) {
    if (revealed[key]) {
      setRevealed(current => withoutKey(current, key))

      return
    }

    try {
      const result = await revealEnvVar(key)
      setRevealed(current => ({ ...current, [key]: result.value }))
    } catch (err) {
      notifyError(err, `Failed to reveal ${key}`)
    }
  }

  return {
    saveValue,
    vars,
    rowProps: {
      edits,
      revealed,
      saving,
      setEdits,
      onSave: handleSave,
      onClear: handleClear,
      onReveal: handleReveal
    }
  }
}

interface CategoryHeadingProps {
  count?: string
  icon: IconComponent
  title: string
}

interface UseEnvCredentials {
  rowProps: Omit<EnvRowProps, 'varKey' | 'info'>
  saveValue: (key: string, value: string) => Promise<{ message?: string; ok: boolean }>
  vars: Record<string, EnvVarInfo> | null
}
