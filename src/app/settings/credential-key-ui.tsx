import { type ChangeEvent, type KeyboardEvent } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ChevronDown, ExternalLink, Loader2, Save } from '@/lib/icons'
import { cn } from '@/lib/utils'
import type { EnvVarInfo } from '@/types/hermes'

import { CONTROL_TEXT } from './constants'
import { withoutKey } from './helpers'
import type { EnvRowProps } from './types'

export type KeyRowProps = Omit<EnvRowProps, 'info' | 'varKey'>

export const CREDENTIAL_CONTROL_CLASS = cn('h-8', CONTROL_TEXT)

export const isKeyVar = (key: string, info: EnvVarInfo) =>
  info.is_password || /(?:_API_KEY|_TOKEN|_KEY)$/.test(key)

export const friendlyFieldLabel = (key: string, info: EnvVarInfo) =>
  info.description?.trim() ||
  key
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, c => c.toUpperCase())

export const credentialPlaceholder = (key: string, info: EnvVarInfo, label: string): string =>
  isKeyVar(key, info) ? `Paste ${label} key` : /URL$/i.test(key) ? 'https://...' : 'Optional'

export function KeyField({
  info,
  placeholder,
  rowProps,
  varKey
}: {
  info: EnvVarInfo
  placeholder?: string
  rowProps: KeyRowProps
  varKey: string
}) {
  const { edits, onClear, onSave, saving, setEdits } = rowProps
  const editing = edits[varKey] !== undefined
  const draft = edits[varKey] ?? ''
  const dirty = draft.trim().length > 0
  const busy = saving === varKey
  const masked = info.redacted_value ?? '••••••••'
  const startEdit = () => setEdits(current => ({ ...current, [varKey]: '' }))
  const cancel = () => setEdits(current => withoutKey(current, varKey))
  const update = (event: ChangeEvent<HTMLInputElement>) => setEdits(current => ({ ...current, [varKey]: event.target.value }))

  const keydown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && dirty) {
      void onSave(varKey)
    } else if (event.key === 'Escape' && editing) {
      event.preventDefault()
      event.stopPropagation()
      cancel()
    }
  }

  if (info.is_set && !editing) {
    return (
      <Input
        className={cn(CREDENTIAL_CONTROL_CLASS, 'cursor-pointer text-[var(--muted)]')}
        onFocus={startEdit}
        readOnly
        value={masked}
      />
    )
  }

  return (
    <div className="grid gap-1">
      <div className="flex items-center gap-2">
        <Input
          autoFocus={editing}
          className={cn(CREDENTIAL_CONTROL_CLASS, 'min-w-0 flex-1')}
          onChange={update}
          onKeyDown={keydown}
          placeholder={placeholder ?? 'Paste key'}
          type={info.is_password ? 'password' : 'text'}
          value={draft}
        />
        {dirty ? (
          <Button className="h-8 shrink-0" disabled={busy} onClick={() => void onSave(varKey)} size="sm">
            {busy ? <Loader2 className="animate-spin" /> : <Save />}
            {busy ? 'Saving' : 'Save'}
          </Button>
        ) : null}
      </div>
      {editing ? (
        <div className="flex items-center gap-1 text-[0.6875rem]">
          {info.is_set ? (
            <>
              <Button
                className="h-auto min-h-0 px-0 py-0 text-[0.6875rem] text-[var(--danger)]"
                disabled={busy}
                onClick={() => void onClear(varKey)}
                type="button"
                variant="link"
              >
                Remove
              </Button>
              <span className="text-[var(--muted)]">or</span>
            </>
          ) : null}
          <span className="text-[var(--muted)]">esc to cancel</span>
        </div>
      ) : null}
    </div>
  )
}

export function CredentialDocsLink({ href }: { href: string }) {
  return (
    <a
      className="inline-flex w-fit items-center gap-1 text-[0.72rem] text-[var(--muted)] underline-offset-4 transition-colors hover:text-foreground hover:underline"
      href={href}
      onClick={event => event.stopPropagation()}
      rel="noreferrer"
      target="_blank"
    >
      Get a key
      <ExternalLink className="size-3" />
    </a>
  )
}

export function CredentialKeyCard({
  expanded,
  info,
  label,
  onExpand,
  onToggle,
  placeholder,
  rowProps,
  varKey
}: CredentialKeyCardProps) {
  const docsUrl = info.url?.trim()
  const description = info.description?.trim()
  const expandable = Boolean(description || docsUrl)

  return (
    <div
      className={cn(
        'group/card rounded-[0.7rem] px-2 py-1 transition-colors',
        expandable && 'cursor-pointer',
        expandable && !expanded && 'hover:bg-[var(--workbench-hover)]',
        expanded && 'bg-[var(--surface-secondary)] ring-1 ring-[var(--border)]'
      )}
      onClick={expandable ? onToggle : undefined}
      onKeyDown={
        expandable
          ? event => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                onToggle()
              }
            }
          : undefined
      }
      role={expandable ? 'button' : undefined}
      tabIndex={expandable ? 0 : undefined}
    >
      <div className="grid gap-3 py-2 sm:grid-cols-[minmax(0,1fr)_minmax(15rem,22rem)] sm:items-center">
        <div className="flex min-w-0 items-center gap-2">
          <span className={cn('size-2 shrink-0 rounded-full', info.is_set ? 'bg-[var(--accent)]' : 'bg-[var(--border)]')} />
          <span className="min-w-0 truncate text-[0.84rem] font-medium text-foreground">{label}</span>
          {expandable ? (
            <ChevronDown
              className={cn(
                'size-3.5 shrink-0 text-[var(--muted)] transition',
                expanded ? 'rotate-180 opacity-100' : 'opacity-0 group-hover/card:opacity-100'
              )}
            />
          ) : null}
        </div>

        <div
          className="min-w-0 sm:justify-self-end"
          onClick={event => event.stopPropagation()}
          onFocus={() => {
            if (expandable && !expanded) {
              onExpand()
            }
          }}
        >
          <KeyField info={info} placeholder={placeholder} rowProps={rowProps} varKey={varKey} />
        </div>
      </div>

      {expandable && expanded ? (
        <div className="grid gap-2.5 pb-2 pl-4" onClick={event => event.stopPropagation()}>
          {description ? <p className="text-[0.72rem] leading-5 text-[var(--muted)]">{description}</p> : null}
          {docsUrl ? <CredentialDocsLink href={docsUrl} /> : null}
        </div>
      ) : null}
    </div>
  )
}

interface CredentialKeyCardProps {
  expanded: boolean
  info: EnvVarInfo
  label: string
  onExpand: () => void
  onToggle: () => void
  placeholder?: string
  rowProps: KeyRowProps
  varKey: string
}
