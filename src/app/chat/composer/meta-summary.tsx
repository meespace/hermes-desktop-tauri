import { useI18n } from '@/i18n'
import { cn } from '@/lib/utils'

export const COMPOSER_META_ATTACHED_CLASS =
  'relative z-6 mx-2.5 mb-[-0.82rem] flex min-w-0 flex-nowrap items-center justify-between gap-3 overflow-hidden px-1'

export const COMPOSER_META_STACKED_CLASS =
  'flex flex-col gap-1.5 rounded-[0.82rem] border border-[color-mix(in_srgb,var(--foreground)_5%,transparent)] bg-[color-mix(in_srgb,var(--surface)_78%,transparent)] px-3 py-2'

export const COMPOSER_META_PILL_CLASS =
  'inline-flex min-w-0 items-center gap-1.5 rounded-full border border-[color-mix(in_srgb,var(--foreground)_7%,transparent)] bg-[color-mix(in_srgb,var(--surface)_96%,transparent)] px-3 py-1 text-[0.64rem] font-medium tracking-[0.01em] text-[color-mix(in_srgb,var(--foreground)_76%,transparent)] shadow-[0_0.35rem_1rem_-0.9rem_color-mix(in_srgb,var(--shadow-ink)_10%,transparent)]'

const COMPOSER_META_MASKED_TEXT_CLASS =
  'rounded-full bg-[color-mix(in_srgb,var(--surface)_98%,transparent)] px-2 py-0.5 shadow-[0_0_0_0.25rem_color-mix(in_srgb,var(--surface)_98%,transparent)]'

interface ComposerMetaSummaryProps {
  composerHint: string
  modelLabel: string
  modelTitle: string
  quickSwitchCount: number
  stacked: boolean
  suggestionCount: number
}

export function ComposerMetaSummary({
  composerHint,
  modelLabel,
  modelTitle,
  quickSwitchCount,
  stacked,
  suggestionCount
}: ComposerMetaSummaryProps) {
  const { t } = useI18n()
  const showContextSuggestions = suggestionCount > 0
  const showQuickModels = quickSwitchCount > 1

  const leading = (
    <div className={cn('flex min-w-0 items-center gap-2', stacked ? 'flex-wrap' : 'flex-nowrap overflow-hidden')}>
      <span className={cn(COMPOSER_META_PILL_CLASS, stacked ? 'max-w-full' : 'max-w-[min(18rem,42vw)] shrink')} title={modelTitle}>
        <span
          aria-hidden="true"
          className="block size-1.5 shrink-0 rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.95),rgba(96,165,250,0.92)_58%,rgba(59,130,246,0.25)_100%)]"
        />
        <span className="truncate">{modelLabel}</span>
      </span>
      {showContextSuggestions ? (
        <span
          className={cn(
            'truncate text-[0.64rem] leading-none text-[color-mix(in_srgb,var(--foreground)_58%,transparent)]',
            !stacked && 'min-w-0 shrink',
            !stacked && COMPOSER_META_MASKED_TEXT_CLASS
          )}
        >
          {t.composer.meta.contextSuggestions(suggestionCount)}
        </span>
      ) : null}
    </div>
  )

  const trailing = (
    <div
      className={cn(
        'flex min-w-0 items-center gap-2 text-[0.64rem] leading-none text-[color-mix(in_srgb,var(--foreground)_52%,transparent)]',
        stacked ? 'flex-wrap justify-between' : 'shrink-0 flex-nowrap justify-end overflow-hidden'
      )}
    >
      {showQuickModels ? (
        <span className={cn(COMPOSER_META_PILL_CLASS, 'shrink-0 px-2.5 py-1 font-normal')}>
          {t.composer.meta.quickModels(quickSwitchCount)}
        </span>
      ) : null}
      <span className={cn('truncate', stacked && 'w-full text-left', !stacked && 'min-w-0 shrink', !stacked && COMPOSER_META_MASKED_TEXT_CLASS)}>
        {composerHint}
      </span>
    </div>
  )

  if (stacked) {
    return (
      <div className={COMPOSER_META_STACKED_CLASS} data-slot="composer-meta-stacked">
        {leading}
        {trailing}
      </div>
    )
  }

  return (
    <div className={COMPOSER_META_ATTACHED_CLASS} data-slot="composer-meta-attached">
      {leading}
      {trailing}
    </div>
  )
}
