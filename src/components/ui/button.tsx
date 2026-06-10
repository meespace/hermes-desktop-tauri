import { buttonVariants as heroButtonVariants } from '@heroui/styles/components/button'
import { Slot } from 'radix-ui'
import * as React from 'react'

import { cn } from '@/lib/utils'

type ButtonVariant = 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
type ButtonSize = 'default' | 'xs' | 'sm' | 'lg' | 'icon' | 'icon-xs' | 'icon-sm' | 'icon-lg'

const HERO_VARIANT_MAP: Record<ButtonVariant, 'primary' | 'danger' | 'outline' | 'secondary' | 'ghost' | 'tertiary'> = {
  default: 'primary',
  destructive: 'danger',
  outline: 'outline',
  secondary: 'secondary',
  ghost: 'ghost',
  link: 'tertiary'
}

const HERO_SIZE_MAP: Record<ButtonSize, 'sm' | 'md' | 'lg'> = {
  default: 'md',
  xs: 'sm',
  sm: 'sm',
  lg: 'lg',
  icon: 'md',
  'icon-xs': 'sm',
  'icon-sm': 'sm',
  'icon-lg': 'lg'
}

const SIZE_CLASS_MAP: Record<ButtonSize, string> = {
  default: 'min-h-9 px-4 py-2 text-sm',
  xs: "min-h-6 px-2 py-1 text-[11px] [&_svg:not([class*='size-'])]:size-3",
  sm: 'min-h-8 px-3 py-1.5 text-sm',
  lg: 'min-h-10 px-5 py-2 text-sm',
  icon: 'size-9 p-0',
  'icon-xs': "size-6 p-0 [&_svg:not([class*='size-'])]:size-3",
  'icon-sm': 'size-8 p-0',
  'icon-lg': 'size-10 p-0'
}

const VARIANT_CLASS_MAP: Partial<Record<ButtonVariant, string>> = {
  link: 'bg-transparent px-0 text-[var(--accent)] shadow-none hover:bg-transparent hover:underline'
}

const buttonVariants = ({ size = 'default', variant = 'default' }: { size?: ButtonSize; variant?: ButtonVariant }) =>
  cn(
    heroButtonVariants({
      isIconOnly: size.startsWith('icon'),
      size: HERO_SIZE_MAP[size],
      variant: HERO_VARIANT_MAP[variant]
    }),
    'rounded-[var(--field-radius)] font-medium',
    SIZE_CLASS_MAP[size],
    VARIANT_CLASS_MAP[variant]
  )

function Button({
  className,
  variant = 'default',
  size = 'default',
  asChild = false,
  ...props
}: React.ComponentProps<'button'> & {
  variant?: ButtonVariant
  size?: ButtonSize
  asChild?: boolean
}) {
  const Comp = asChild ? Slot.Root : 'button'

  return (
    <Comp
      className={cn(buttonVariants({ variant, size }), className)}
      data-size={size}
      data-slot="button"
      data-variant={variant}
      {...props}
    />
  )
}

export { Button, buttonVariants }
