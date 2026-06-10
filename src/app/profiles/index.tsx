import type * as React from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { PageLoader } from '@/components/page-loader'
import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import { Textarea } from '@/components/ui/textarea'
import {
  getProfiles,
  getProfileSetupCommand,
  getProfileSoul,
  type ProfileInfo,
  updateProfileSoul
} from '@/hermes'
import { useI18n } from '@/i18n'
import { AlertTriangle, Pencil, Save, Terminal, Trash2, Users } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { notify, notifyError } from '@/store/notifications'

import { CreateProfileDialog } from './create-profile-dialog'
import { DeleteProfileDialog } from './delete-profile-dialog'
import { RenameProfileDialog } from './rename-profile-dialog'
import type { SetStatusbarItemGroup } from '../shell/statusbar-controls'
import { titlebarHeaderBaseClass } from '../shell/titlebar'
import type { SetTitlebarToolGroup } from '../shell/titlebar-controls'

interface ProfilesViewProps extends React.ComponentProps<'section'> {
  setStatusbarItemGroup?: SetStatusbarItemGroup
  setTitlebarToolGroup?: SetTitlebarToolGroup
}

export function ProfilesView({
  setStatusbarItemGroup: _setStatusbarItemGroup,
  setTitlebarToolGroup,
  ...props
}: ProfilesViewProps) {
  const { t } = useI18n()
  const p = t.profiles
  const [profiles, setProfiles] = useState<null | ProfileInfo[]>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedName, setSelectedName] = useState<null | string>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<null | ProfileInfo>(null)

  const refresh = useCallback(async () => {
    setRefreshing(true)

    try {
      const { profiles: list } = await getProfiles()
      setProfiles(list)
      setSelectedName(current => {
        if (current && list.some(p => p.name === current)) {
          return current
        }

        return list.find(p => p.is_default)?.name ?? list[0]?.name ?? null
      })
    } catch (err) {
      notifyError(err, 'Failed to load profiles')
    } finally {
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (!setTitlebarToolGroup) {
      return
    }

    setTitlebarToolGroup('profiles', [
      {
        disabled: refreshing,
        icon: <Codicon name="refresh" spinning={refreshing} />,
        id: 'refresh-profiles',
        label: refreshing ? 'Refreshing profiles' : 'Refresh profiles',
        onSelect: () => void refresh()
      }
    ])

    return () => setTitlebarToolGroup('profiles', [])
  }, [refresh, refreshing, setTitlebarToolGroup])

  const selected = useMemo(() => {
    if (!profiles) {
      return null
    }

    return profiles.find(p => p.name === selectedName) ?? profiles[0] ?? null
  }, [profiles, selectedName])

  return (
    <section
      {...props}
      className="flex h-full min-w-0 flex-col overflow-hidden rounded-b-[0.9375rem] bg-[var(--background)]"
    >
      <header className={titlebarHeaderBaseClass}>
        <h2 className="pointer-events-auto text-base font-semibold leading-none tracking-tight">{p.manage}</h2>
        <span className="pointer-events-auto text-xs text-[var(--muted)]">
          {profiles ? p.profileCount(profiles.length) : ''}
        </span>
      </header>

      <div className="min-h-0 flex-1 overflow-hidden rounded-b-[1.0625rem] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--surface-shadow)]">
        {!profiles ? (
          <PageLoader label={p.loading} />
        ) : (
          <div className="grid h-full min-h-0 grid-cols-1 lg:grid-cols-[16rem_minmax(0,1fr)]">
            <aside className="flex min-h-0 flex-col overflow-hidden border-b border-[var(--separator)] bg-[var(--surface-secondary)]/42 lg:border-b-0 lg:border-r">
              <div className="border-b border-[var(--separator)] p-2">
                <Button className="w-full" onClick={() => setCreateOpen(true)} size="sm">
                  <Codicon name="add" />
                  {p.newProfile}
                </Button>
              </div>
              <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
                {profiles.map(profile => (
                  <li key={profile.name}>
                    <ProfileRow
                      active={selected?.name === profile.name}
                      onSelect={() => setSelectedName(profile.name)}
                      profile={profile}
                    />
                  </li>
                ))}
                {profiles.length === 0 && (
                  <li className="px-2 py-4 text-center text-xs text-[var(--muted)]">{p.noProfiles}</li>
                )}
              </ul>
            </aside>

            <main className="min-h-0 overflow-hidden">
              {selected ? (
                <ProfileDetail
                  key={selected.name}
                  onDelete={() => setPendingDelete(selected)}
                  onRenamed={async newName => {
                    notify({ kind: 'success', title: 'Profile renamed', message: `${selected.name} → ${newName}` })
                    setSelectedName(newName)
                    await refresh()
                  }}
                  profile={selected}
                />
              ) : (
                <div className="grid h-full place-items-center px-6 py-12 text-center text-sm text-[var(--muted)]">
                  <div>
                    <Users className="mx-auto size-6 text-[var(--muted)]" />
                    <p className="mt-3">{p.selectPrompt}</p>
                  </div>
                </div>
              )}
            </main>
          </div>
        )}
      </div>

      <CreateProfileDialog
        onClose={() => setCreateOpen(false)}
        onCreated={async name => {
          notify({ kind: 'success', title: 'Profile created', message: name })
          setSelectedName(name)
          await refresh()
        }}
        open={createOpen}
      />

      <DeleteProfileDialog
        onClose={() => setPendingDelete(null)}
        onDeleted={async name => {
          notify({ kind: 'success', title: 'Profile deleted', message: name })
          setSelectedName(null)
          await refresh()
        }}
        open={pendingDelete !== null}
        profile={pendingDelete}
      />
    </section>
  )
}

function ProfileRow({ active, onSelect, profile }: { active: boolean; onSelect: () => void; profile: ProfileInfo }) {
  const { t } = useI18n()
  const p = t.profiles

  return (
    <button
      className={cn(
        'flex w-full flex-col items-start gap-1 rounded-[calc(var(--radius)*1.75)] border px-2.5 py-2 text-left shadow-[var(--field-shadow)] transition-[background-color,border-color,color,box-shadow]',
        active
          ? 'border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)]'
          : 'border-transparent bg-transparent text-[color-mix(in_srgb,var(--foreground)_84%,transparent)] hover:border-[var(--border)] hover:bg-[var(--surface)] hover:text-[var(--foreground)]'
      )}
      onClick={onSelect}
      type="button"
    >
      <span className="flex w-full items-center justify-between gap-2">
        <span className="truncate text-sm font-medium">{profile.name}</span>
        {profile.is_default && (
          <span className="rounded-full bg-[var(--accent-soft)] px-1.5 py-0.5 text-[0.6rem] text-[var(--accent-soft-foreground)]">
            {p.default}
          </span>
        )}
      </span>
      <span className="text-[0.66rem] text-[var(--muted)]">
        {profile.skill_count} {profile.skill_count === 1 ? 'skill' : 'skills'}
        {profile.has_env ? ` · ${p.env}` : ''}
      </span>
    </button>
  )
}

function ProfileDetail({
  onDelete,
  onRenamed,
  profile
}: {
  onDelete: () => void
  onRenamed: (newName: string) => Promise<void>
  profile: ProfileInfo
}) {
  const { t } = useI18n()
  const p = t.profiles
  const [renameOpen, setRenameOpen] = useState(false)
  const [copying, setCopying] = useState(false)

  const handleCopySetup = useCallback(async () => {
    setCopying(true)

    try {
      const { command } = await getProfileSetupCommand(profile.name)
      await navigator.clipboard.writeText(command)
      notify({ kind: 'success', title: 'Setup command copied', message: command })
    } catch (err) {
      notifyError(err, 'Failed to copy setup command')
    } finally {
      setCopying(false)
    }
  }, [profile.name])

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl space-y-6 px-6 py-6">
          <header className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-xl font-semibold tracking-tight">{profile.name}</h3>
                  {profile.is_default && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[0.65rem] font-medium text-primary">
                      Default
                    </span>
                  )}
                  {profile.has_env && (
                    <span className="rounded-full bg-[var(--default-soft)] px-2 py-0.5 text-[0.65rem] font-medium text-[var(--default-soft-foreground)]">
                      .env
                    </span>
                  )}
                </div>
                <p className="mt-1 font-mono text-[0.7rem] text-[var(--muted)]" title={profile.path}>
                  {profile.path}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {!profile.is_default && (
                  <Button onClick={() => setRenameOpen(true)} size="sm" variant="outline">
                    <Pencil />
                    {p.rename}
                  </Button>
                )}
                <Button disabled={copying} onClick={() => void handleCopySetup()} size="sm" variant="outline">
                  <Terminal />
                  {copying ? p.copying : p.copySetup}
                </Button>
                {!profile.is_default && (
                  <Button
                    className="text-[var(--muted)] hover:bg-destructive/10 hover:text-destructive"
                    onClick={onDelete}
                    size="sm"
                    variant="ghost"
                  >
                    <Trash2 />
                    {p.delete}
                  </Button>
                )}
              </div>
            </div>

            <dl className="grid gap-2 rounded-[calc(var(--radius)*1.75)] border border-[var(--border)] bg-[var(--surface-secondary)] px-3 py-3 text-xs shadow-[var(--field-shadow)] sm:grid-cols-2">
              <DetailRow label="Model">
                {profile.model ? (
                  <>
                    <span className="font-mono">{profile.model}</span>
                    {profile.provider && <span className="text-[var(--muted)]"> · {profile.provider}</span>}
                  </>
                ) : (
                  <span className="text-[var(--muted)]">Not set</span>
                )}
              </DetailRow>
              <DetailRow label="Skills">{profile.skill_count}</DetailRow>
            </dl>
          </header>

          <SoulEditor profileName={profile.name} />
        </div>
      </div>

      <RenameProfileDialog
        currentName={profile.name}
        onClose={() => setRenameOpen(false)}
        onRenamed={onRenamed}
        open={renameOpen}
      />
    </div>
  )
}

function DetailRow({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className="flex flex-wrap items-baseline gap-2">
      <dt className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">{label}</dt>
      <dd className="text-sm text-foreground">{children}</dd>
    </div>
  )
}

function SoulEditor({ profileName }: { profileName: string }) {
  const { t } = useI18n()
  const p = t.profiles
  const [content, setContent] = useState('')
  const [original, setOriginal] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<null | string>(null)
  const requestRef = useRef<string>(profileName)

  useEffect(() => {
    requestRef.current = profileName
    setLoading(true)
    setError(null)
    setContent('')
    setOriginal('')

    void (async () => {
      try {
        const soul = await getProfileSoul(profileName)

        if (requestRef.current === profileName) {
          setContent(soul.content)
          setOriginal(soul.content)
        }
      } catch (err) {
        if (requestRef.current === profileName) {
          setError(err instanceof Error ? err.message : 'Failed to load SOUL.md')
        }
      } finally {
        if (requestRef.current === profileName) {
          setLoading(false)
        }
      }
    })()
  }, [profileName])

  const dirty = content !== original
  const isEmpty = !content.trim()

  async function handleSave() {
    setSaving(true)
    setError(null)

    try {
      await updateProfileSoul(profileName, content)
      setOriginal(content)
      notify({ kind: 'success', title: p.soulSaved, message: profileName })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save SOUL.md')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h4 className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">SOUL.md</h4>
          <p className="text-xs text-[var(--muted)]">{p.soulDescription}</p>
        </div>
        {dirty && <span className="text-[0.65rem] text-[var(--muted)]">{p.soulUnsaved}</span>}
      </div>

      {loading ? (
        <div className="grid h-44 place-items-center rounded-[calc(var(--radius)*1.75)] border border-[var(--border)] bg-[var(--surface-secondary)] text-xs text-[var(--muted)] shadow-[var(--field-shadow)]">
          {p.soulLoading}
        </div>
      ) : (
        <Textarea
          className="min-h-72 font-mono text-xs leading-5"
          onChange={event => setContent(event.target.value)}
          placeholder={isEmpty ? p.soulEmpty : undefined}
          value={content}
        />
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex justify-end">
        <Button disabled={!dirty || saving || loading} onClick={() => void handleSave()} size="sm">
          <Save />
          {saving ? t.common.saving : 'Save SOUL.md'}
        </Button>
      </div>
    </section>
  )
}
