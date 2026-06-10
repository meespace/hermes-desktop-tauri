import { cn } from '@/lib/utils'

const assetPath = (path: string) => `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`

export function BrandMark({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      className={cn(
        'inline-flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-[0.75rem] bg-white shadow-[var(--field-shadow)]',
        className
      )}
      {...props}
    >
      <img alt="" className="size-full object-contain" src={assetPath('nous-girl.jpg')} />
    </span>
  )
}
