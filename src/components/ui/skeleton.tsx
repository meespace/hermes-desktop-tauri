import { cn } from '@/lib/utils'

function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('skeleton skeleton--shimmer', className)} data-slot="skeleton" {...props} />
}

export { Skeleton }
