import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { deleteProfile } from '@/hermes'
import { AlertTriangle } from '@/lib/icons'
import type { ProfileInfo } from '@/types/hermes'

export function DeleteProfileDialog({
  onClose,
  onDeleted,
  open,
  profile
}: {
  onClose: () => void
  onDeleted?: (name: string) => Promise<void> | void
  open: boolean
  profile: null | ProfileInfo
}) {
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<null | string>(null)

  async function handleDelete() {
    if (!profile || deleting) {
      return
    }

    setDeleting(true)
    setError(null)

    try {
      await deleteProfile(profile.name)
      await onDeleted?.(profile.name)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete profile')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Dialog
      onOpenChange={value => {
        if (!value && !deleting) {
          setError(null)
          onClose()
        }
      }}
      open={open && profile !== null}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Delete profile?</DialogTitle>
          <DialogDescription>
            {profile ? (
              <>
                This will delete <span className="font-medium text-foreground">{profile.name}</span>
                {profile.path ? (
                  <>
                    {' '}
                    and remove <span className="font-mono text-xs">{profile.path}</span>
                  </>
                ) : null}
                . This cannot be undone.
              </>
            ) : null}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <DialogFooter>
          <Button disabled={deleting} onClick={onClose} type="button" variant="outline">
            Cancel
          </Button>
          <Button disabled={deleting || !profile} onClick={() => void handleDelete()} type="button" variant="destructive">
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
