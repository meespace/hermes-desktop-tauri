import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { createProfile, updateProfileSoul } from '@/hermes'
import { AlertTriangle } from '@/lib/icons'
import { cn } from '@/lib/utils'

export const PROFILE_NAME_HINT =
  'Lowercase letters, digits, hyphens, and underscores. Must start with a letter or digit.'

const PROFILE_NAME_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/

export function isValidProfileName(name: string): boolean {
  return PROFILE_NAME_RE.test(name.trim())
}

export function CreateProfileDialog({
  onClose,
  onCreated,
  open
}: {
  onClose: () => void
  onCreated?: (name: string) => Promise<void> | void
  open: boolean
}) {
  const [name, setName] = useState('')
  const [cloneFromDefault, setCloneFromDefault] = useState(true)
  const [soul, setSoul] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<null | string>(null)

  useEffect(() => {
    if (!open) {
      return
    }

    setName('')
    setCloneFromDefault(true)
    setSoul('')
    setError(null)
    setSaving(false)
  }, [open])

  const trimmed = name.trim()
  const invalid = trimmed !== '' && !isValidProfileName(trimmed)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()

    if (!trimmed || invalid) {
      setError(invalid ? `Invalid name. ${PROFILE_NAME_HINT}` : 'Name is required.')

      return
    }

    setSaving(true)
    setError(null)

    try {
      await createProfile({ name: trimmed, clone_from_default: cloneFromDefault })

      if (soul.trim()) {
        await updateProfileSoul(trimmed, soul)
      }

      await onCreated?.(trimmed)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create profile')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog onOpenChange={value => !value && !saving && onClose()} open={open}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New profile</DialogTitle>
          <DialogDescription>Profiles keep separate config, skills, and SOUL.md.</DialogDescription>
        </DialogHeader>

        <form className="grid gap-4" onSubmit={handleSubmit}>
          <div className="grid gap-1.5">
            <label className="text-xs font-medium" htmlFor="new-profile-name">
              Name
            </label>
            <Input
              aria-invalid={invalid}
              autoFocus
              id="new-profile-name"
              onChange={event => setName(event.target.value)}
              placeholder="my-profile"
              value={name}
            />
            <p className={cn('text-[0.66rem] leading-4', invalid ? 'text-destructive' : 'text-[var(--muted)]')}>
              {PROFILE_NAME_HINT}
            </p>
          </div>

          <label className="flex cursor-pointer items-center gap-2 rounded-[calc(var(--radius)*1.75)] border border-[var(--border)] bg-[var(--surface-secondary)] px-3 py-2 text-sm shadow-[var(--field-shadow)]">
            <input
              checked={cloneFromDefault}
              className="size-4 accent-primary"
              onChange={event => setCloneFromDefault(event.target.checked)}
              type="checkbox"
            />
            <span>
              <span className="font-medium">Clone from default</span>
              <span className="ml-2 text-xs text-[var(--muted)]">Copy config, skills, and SOUL.md.</span>
            </span>
          </label>

          <div className="grid gap-1.5">
            <label className="text-xs font-medium" htmlFor="new-profile-soul">
              Optional SOUL.md
            </label>
            <textarea
              className="min-h-24 rounded-[var(--field-radius)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none shadow-[var(--field-shadow)] focus:border-[var(--focus)]"
              id="new-profile-soul"
              onChange={event => setSoul(event.target.value)}
              placeholder="Leave blank to keep the cloned/default persona."
              value={soul}
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <DialogFooter>
            <Button disabled={saving} onClick={onClose} type="button" variant="outline">
              Cancel
            </Button>
            <Button disabled={saving || !trimmed || invalid} type="submit">
              {saving ? 'Creating...' : 'Create profile'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
