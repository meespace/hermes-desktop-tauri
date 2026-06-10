import { useStore } from '@nanostores/react'
import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import type { HermesGateway } from '@/hermes'
import { getGlobalModelOptions } from '@/hermes'
import { useI18n } from '@/i18n'
import { displayModelName, modelDisplayParts } from '@/lib/model-status-label'
import { cn } from '@/lib/utils'
import {
  $visibleModels,
  collapseModelFamilies,
  effectiveVisibleKeys,
  modelVisibilityKey,
  setVisibleModels
} from '@/store/model-visibility'
import type { ModelOptionProvider, ModelOptionsResponse } from '@/types/hermes'

interface ModelVisibilityDialogProps {
  gw?: HermesGateway
  onOpenChange: (open: boolean) => void
  onOpenProviders: () => void
  open: boolean
  sessionId?: string | null
}

export function ModelVisibilityDialog({ gw, onOpenChange, onOpenProviders, open, sessionId }: ModelVisibilityDialogProps) {
  const { t } = useI18n()
  const [search, setSearch] = useState('')
  const stored = useStore($visibleModels)

  const modelOptions = useQuery({
    queryKey: ['model-options', sessionId || 'global'],
    queryFn: (): Promise<ModelOptionsResponse> => {
      if (gw && sessionId) {
        return gw.request<ModelOptionsResponse>('model.options', { session_id: sessionId })
      }

      return getGlobalModelOptions()
    },
    enabled: open
  })

  const providers = useMemo(
    () => (modelOptions.data?.providers ?? []).filter(provider => (provider.models ?? []).length > 0),
    [modelOptions.data]
  )

  const visible = effectiveVisibleKeys(stored, providers)

  const toggle = (provider: ModelOptionProvider, model: string) => {
    const next = new Set(effectiveVisibleKeys($visibleModels.get(), providers))
    const key = modelVisibilityKey(provider.slug, model)

    if (next.has(key)) {
      next.delete(key)
    } else {
      next.add(key)
    }

    setVisibleModels(next)
  }

  const q = search.trim().toLowerCase()

  const matches = (provider: ModelOptionProvider, model: string) =>
    !q || `${model} ${provider.name} ${provider.slug} ${displayModelName(model)}`.toLowerCase().includes(q)

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-w-sm gap-0 overflow-hidden border-[var(--border)] bg-[var(--overlay)] p-0 shadow-[var(--overlay-shadow)]">
        <DialogHeader className="px-4 pb-0 pt-4">
          <DialogTitle className="text-sm font-semibold text-[var(--foreground)]">{t.settings.sections.model}</DialogTitle>
          <DialogDescription className="text-xs text-[var(--muted)]">
            {t.settings.sectionDescriptions.model}
          </DialogDescription>
        </DialogHeader>

        <div className="px-4 py-3">
          <Input
            autoFocus
            className="h-9 px-3 text-sm shadow-[var(--field-shadow)]"
            onChange={event => setSearch(event.target.value)}
            placeholder={t.modelPicker.filterPlaceholder}
            type="text"
            value={search}
          />
        </div>

        <div className="max-h-[55vh] overflow-y-auto px-2 pb-2">
          {providers.length === 0 ? (
            <div className="mx-2 grid min-h-28 place-items-center rounded-[calc(var(--radius)*2)] border border-[var(--border)] bg-[var(--surface)] px-4 py-5 text-center text-xs text-[var(--muted)] shadow-[var(--field-shadow)]">
              {modelOptions.isPending ? t.common.loading : t.modelPicker.noAuthenticatedProviders}
            </div>
          ) : (
            providers.map(provider => {
              const models = collapseModelFamilies(provider.models ?? []).filter(family =>
                matches(provider, family.id)
              )

              if (models.length === 0) {
                return null
              }

              return (
                <section
                  className="mx-2 mb-2 overflow-hidden rounded-[calc(var(--radius)*2)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--field-shadow)]"
                  key={provider.slug}
                >
                  <div className="border-b border-[var(--separator)] bg-[var(--surface-secondary)] px-3 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                    {provider.name}
                  </div>
                  {models.map(family => {
                    const { name, tag } = modelDisplayParts(family.id)
                    const key = modelVisibilityKey(provider.slug, family.id)

                    return (
                      <label
                        className={cn(
                          'flex min-h-10 cursor-pointer items-center gap-3 px-3 py-2 text-sm transition-colors hover:bg-[var(--surface-secondary)]',
                          'border-t border-[var(--separator)] first:border-t-0'
                        )}
                        key={key}
                      >
                        <span className="min-w-0 flex-1 truncate">
                          {name}
                          {tag ? <span className="text-[var(--muted)]"> {tag}</span> : null}
                        </span>
                        <Switch
                          checked={visible.has(key)}
                          className="cursor-pointer"
                          onCheckedChange={() => toggle(provider, family.id)}
                        />
                      </label>
                    )
                  })}
                </section>
              )
            })
          )}
        </div>

        <div className="border-t border-[var(--separator)] px-4 py-3">
          <Button
            className="h-auto px-0 text-[var(--accent)] hover:text-[var(--accent)]"
            onClick={() => {
              onOpenChange(false)
              onOpenProviders()
            }}
            type="button"
            variant="ghost"
          >
            {t.modelPicker.addProvider}…
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
