import { useEffect, useState } from 'react'

import { cn } from '@/lib/utils'

const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

export function ChatSwapOverlay({ profile }: { profile: string | null }) {
  const [frame, setFrame] = useState(0)
  const [label, setLabel] = useState<null | string>(profile)

  useEffect(() => {
    if (profile) {
      setLabel(profile)
    }
  }, [profile])

  useEffect(() => {
    if (!profile) {
      return
    }

    const id = window.setInterval(() => setFrame(value => (value + 1) % FRAMES.length), 80)

    return () => window.clearInterval(id)
  }, [profile])

  return (
    <div
      aria-hidden
      className={cn(
        'pointer-events-none absolute inset-0 z-50 flex items-center justify-center transition-opacity duration-150 ease-out',
        profile ? 'opacity-100' : 'opacity-0'
      )}
    >
      <div className="flex items-center gap-2 rounded-[0.8rem] border border-[var(--workbench-panel-stroke)] bg-[var(--overlay)] px-4 py-2 font-mono text-[0.78rem] text-foreground shadow-[var(--surface-shadow)]">
        <span className="w-3 text-[var(--accent)]">{FRAMES[frame]}</span>
        <span>Waking {label ?? 'profile'}...</span>
      </div>
    </div>
  )
}
