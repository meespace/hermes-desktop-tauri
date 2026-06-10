import type { IconComponent } from '@/lib/icons'
import { cn } from '@/lib/utils'

export interface SegmentedControlOption<T extends string> {
  icon?: IconComponent
  id: T
  label: string
}

interface SegmentedControlProps<T extends string> {
  className?: string
  onChange: (id: T) => void
  options: readonly SegmentedControlOption<T>[]
  value: T
}

export function SegmentedControl<T extends string>({
  className,
  onChange,
  options,
  value
}: SegmentedControlProps<T>) {
  return (
    <div
      className={cn(
        'inline-grid w-fit auto-cols-fr grid-flow-col gap-0.5 rounded-[5px] bg-[var(--surface-secondary)] p-0.5',
        className
      )}
    >
      {options.map(({ id, label, icon: Icon }) => {
        const active = value === id

        return (
          <button
            aria-pressed={active}
            className={cn(
              'flex items-center justify-center gap-1 rounded-[3px] px-2.5 py-0.5 text-[0.6875rem] font-medium transition-colors',
              active ? 'bg-[var(--surface)] text-[var(--foreground)] shadow-[var(--field-shadow)]' : 'text-[var(--muted)] hover:text-[var(--foreground)]'
            )}
            key={id}
            onClick={() => onChange(id)}
            type="button"
          >
            {Icon ? <Icon className="size-3" /> : null}
            {label}
          </button>
        )
      })}
    </div>
  )
}
